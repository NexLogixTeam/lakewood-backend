/* eslint-disable */

/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const logger = require('firebase-functions/logger');

const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
let db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

const Typesense = require('typesense');

const client = new Typesense.Client({
  nodes: [
    {
      host: 'tb3j850e7w6yi1dxp-1.a1.typesense.net', // Replace with your Typesense server host
      port: 443, // Replace with your server port
      protocol: 'https', // Use 'https' if using Typesense Cloud or a secured server
    },
  ],
  apiKey: '8JocHBdIQzmxfFNCkJU8TmLgX6Wp8HDA', // Replace with your API key
  connectionTimeoutSeconds: 4,
});

// Firestore trigger for new product addition
exports.syncNewProductToTypesense = functions.firestore
  .document('Products/{productId}')
  .onCreate(async (snap, context) => {
    logger.info('Syncing new product to typesense>>>', snap.id);
    const newProduct = snap.data();
    const productId = context.params.productId;

    try {
      // Add the new product to Typesense
      await client
        .collections('Products')
        .documents()
        .create({
          ...newProduct,
          key: productId,
          id: productId,
          createdAt: newProduct.createdAt ? newProduct.createdAt.toDate() : '',
        });

      logger.log(`Successfully added product ${productId} to Typesense`);
    } catch (error) {
      logger.error(`Error adding product ${productId} to Typesense:`, error);
    }
  });

// Firestore trigger for new product addition
exports.syncUpdatedProductToTypesense = functions.firestore
  .document('Products/{productId}')
  .onUpdate(async (snap, context) => {
    const updatedProduct = snap.after.data();
    const productId = context.params.productId;

    try {
      // Add the new product to Typesense
      await client
        .collections('Products')
        .documents(productId)
        .update({
          ...updatedProduct,
          key: productId,
          createdAt: updatedProduct.createdAt
            ? updatedProduct.createdAt.toDate()
            : '',
        });

      logger.info(`Successfully product updated ${productId} to Typesense`);
    } catch (error) {
      logger.info(`Error adding product ${productId} to Typesense:`, error);
    }
  });

exports.syncDeletedProductFromTypesense = functions.firestore
  .document('Products/{productId}')
  .onDelete(async (snap, context) => {
    const productId = context.params.productId;
    try {
      await client.collections('Products').documents(productId).delete();
      logger.info(`Successfully deleted product ${productId} from Typesense`);
    } catch (error) {
      logger.error(
        `Error deleting product ${productId} from Typesense:`,
        error
      );
    }
  });

async function getUser(userId) {
  let userRef = db.collection('Users').doc(userId);
  let getDoc = userRef
    .get()
    .then((doc) => {
      if (!doc.exists) {
        console.log('No such document!');
        return 0;
      } else {
        console.log('Document data:', doc.data());
        return doc.data();
      }
    })
    .catch((err) => {
      console.log('Error getting document', err);
    });
  // [END get_document]
  return getDoc;
}

exports.sendNotification = functions.firestore
  .document('Notifications/{id}')
  .onCreate(async (snapshot, context) => {
    const user = await getUser(snapshot.data().userId);
    let recipientDetails;
    if (snapshot.data().recipientId) {
      recipientDetails = {
        recipientId: snapshot.data().recipientId,
        productId: snapshot.data().productId,
        screen: 'ChatDetails',
        // badge: user.unreadNotifications || 0,
        // badge: 0,
      };
    } else {
      recipientDetails = {};
    }

    const dataPayload = JSON.stringify(recipientDetails);

    const message = {
      // tokens: [snapshot.data().receiverToken],
      tokens: snapshot.data().receiverToken,
      notification: {
        title: `${snapshot.data().title}`,
        body: `${snapshot.data().body}`,
      },
      data: {
        details: dataPayload, // Wrap the stringified payload in an object
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'horn.wav',
            // badge: user.unreadNotifications || 0,
          },
        },
      },
      ios: {
        sound: 'horn.wav',
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'sound_channel',
          sound: 'horn.wav',
          //notification_count: 0,
        },
      },
    };

    return await admin
      .messaging()
      .sendEachForMulticast(message)
      .then((response) => {
        return logger.info(`A new notification for  =====`, response);
      })
      .catch((e) => logger.info('------ error:', e));
  });

/* eslint-enable */
