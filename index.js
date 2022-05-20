const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
const cors = require("cors")
const dotenv = require("dotenv").config()
const jwt = require('jsonwebtoken');
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
    res.send("running well")
})

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized" })
    }
    const token = authHeader.split(" ")[1]

    jwt.verify(token, process.env.PRIVATE_KEY, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden" })
        }
        req.decoded = decoded;
        next()
    })
}

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.ysokc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect()
        const treatmentCollection = client.db("appointment").collection('treatment')
        const bookedByUserCollection = client.db("appointment").collection('bookedByUser')
        const usersCollection = client.db("users").collection('users')
        app.get("/treatment", async (req, res) => {
            const query = {}
            const cursor = treatmentCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })
        app.post("/treatment", async (req, res) => {
            const bookedByUser = req.body
            const query = { name: bookedByUser.name, date: bookedByUser.date, email: bookedByUser.email }
            const exist = await bookedByUserCollection.findOne(query)
            if (exist) {
                return res.send({ message: "Sorry you can book  once", success: false })
            }
            else {
                const result = await bookedByUserCollection.insertOne(bookedByUser)
                res.send({ success: true, result })

            }
        })

        // Warning: This is not the proper way to query multiple collection. 
        // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1:  get all services
            const services = await treatmentCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookedByUserCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.name === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });


            res.send(services);
        })
        app.get("/bookings", verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (decodedEmail === email) {
                const query = { email: email }
                const result = await bookedByUserCollection.find(query).toArray()
                return res.send(result)
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }
        })
        //    creating user 
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, option)

            const token = jwt.sign({ email: email }, process.env.PRIVATE_KEY, { expiresIn: "1d" })
            res.send({ token })
        })
        // making admin 
        app.put("/user/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email
            const requester = req.decoded.email
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === "admin") {
                const filter = { email: email }
                const updateDoc = {
                    $set: {
                        role: "admin"
                    }
                }
                const result = await usersCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else{
               res.status(403).send({message:"forbidden"})
            }

        })
        // get users list 
        app.get("/users", verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })
        // get user for check role 
        app.get("/admin/:email", verifyJWT, async (req, res) => {
            const email=req.params.email 
            const user = await usersCollection.findOne({email:email})
   
           const isAdmin=user.role==='admin'
           res.send({admin:isAdmin})
        })
         

    }
    finally {

    }
}
run().catch(console.dir)



app.listen(port, () => {
    console.log("i am also well");
})
