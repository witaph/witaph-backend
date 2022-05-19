const express = require('express')
const cors = require('cors')
const mysql = require('mysql2')
const dotenv = require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const bodyParser = require('body-parser')

const controller = require('./controller')
const PORT = process.env.PORT || 8000

let logStream = fs.createWriteStream('log.txt')
let console = {}
console.log = (str, obj) => {
  var s = str
  if (!!obj) {
  	if (typeof obj === 'string')
  		s += obj
  	else
    	s += JSON.stringify(obj)
  }

  var dS = '[' + moment().format() + '] '
  s = `[${dS}] ${s}\n`
  logStream.write(s)
}

const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
})

db.connect(err => {
	if(err) {
		throw err
	}
	console.log('MySQL connected')
})

const app = express()
// const corsOptions = {
// 	origin: process.env.CLIENT_ADDRESS,
// 	optionsSuccessStatus: 200,
// 	credentials: true,
// }
// app.use(cors(corsOptions))
app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use((req, res, next) => {
	res.header(
		'Access-Control-Allow-Headers',
		'x-access-token, Origin, Content-Type, Accept'
	)
	next()
})

app.get('/api/images', controller.getImages)
app.post('/api/login', controller.login)
app.post('/api/addImage', [middleware.verifyToken], controller.addImage)

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`)
})
