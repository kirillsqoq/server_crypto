const express = require("express");
const app = express();
const port = 2000;
const {
	initializeApp,
	applicationDefault,
	cert,
} = require("firebase-admin/app");
const {
	getFirestore,
	Timestamp,
	FieldValue,
} = require("firebase-admin/firestore");
const mempool = require("@mempool/mempool.js");

var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKey.json");

const appFire = admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});
const db = getFirestore(appFire);
//

const userRef = db.collection("users");

const ticketsRef = (userID) =>
	db.collection("users").doc(userID).collection("tickets");

function getConfirmationTickets(scriptpubkey_address, value, user, ticket) {
	if (scriptpubkey_address == user.wallet) {
		console.log(ticket.data().amount);
		console.log(value / 100000000);
		if (ticket.data().amount == (value / 100000000).toString()) {
			console.log("transaction detected");
			ticket.ref.set(
				{
					show: true,
					status: "confirm",
					statusColor: "positive",
				},
				{ merge: true }
			);
		}
	}
}

function changeStatus(myAddressTxsMempool, user, ticket) {
	myAddressTxsMempool.map((v) => {
		v.vout.map((vout) =>
			getConfirmationTickets(
				vout.scriptpubkey_address,
				vout.value,
				user,
				ticket
			)
		);
	});
}

function checkMempoolFunc(user, ticket) {
	console.log("вызов функции чек мемпул");
	const init = async () => {
		const {
			bitcoin: { addresses, transactions },
		} = mempool({
			hostname: "mempool.space",
		});

		const address = user.wallet;

		const myAddressTxsMempool = await addresses.getAddressTxsMempool({
			address,
		});
		// console.log(addressTxsMempool);
		// console.log(myAddressTxs);

		changeStatus(myAddressTxsMempool, user, ticket);
	};

	init();
}

function createUserData(db, user, balance, myAddressTxs, addressTxsMempool) {
	console.log(myAddressTxs, addressTxsMempool);
	// setDoc(
	// 	doc(db, "users", user.uid),
	// 	{
	// 		balance: balance / 100000000,
	// 		myAddressTxs: myAddressTxs,
	// 		myAddressTxsMempool: addressTxsMempool,
	// 	},
	// 	{ merge: true }
	// );
}

function debounce(func, timeout) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			func.apply(this, args);
		}, timeout);
	};
}

async function readFire() {
	const usersArr = [];
	const ticketArr = [];
	// const ticketsInSearch = await ticketsRef
	// 	.where("status", "==", "confirm")
	// 	.get();
	const users = await userRef.get();
	users.forEach((doc) => {
		usersArr.push(doc);
	});

	usersArr.forEach((user) => {
		// console.log(user.data());
		ticketsRef(user.id)
			.where("status", "==", "search")
			.get()
			.then((result) =>
				result.forEach((ticket) => {
					setTimeout(() => {
						checkMempoolFunc(user.data(), ticket);
					}, Math.random() * 15000);

					if (new Date() - 3600000 < ticket.data().time * 1000) {
						// console.log(ticket.data());
						if (ticket.data().name == "ServerTest") {
							ticket.ref.set(
								{
									show: true,
									status: "confirm",
									statusColor: "positive",
								},
								{ merge: true }
							);
						}
					} else {
						ticket.ref.delete();
					}
				})
			);
	});
}

setInterval(() => {
	console.log("server tick");
	readFire();
}, 30000);

app.get("/", (req, res) => {
	res.send("Hello World2!");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
