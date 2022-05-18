const express = require('express')
const cors = require('cors')
const mysql = require('mysql2')
const dotenv = require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const bcrypt = require('bcryptjs')

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

app.get('/api/images', (req, res) => {
	console.log('GET /api/images')
	const sql = 'SELECT * FROM Images'

	db.query(sql, (err, results) => {
		if (err) {
			throw err
		}

		console.log('GET /api/images results: ', results)
		res.send(results)
	})
})

app.post('/api/login', (req, res) => {
	console.log('POST /api/login request.body: ', req.body)
	if (!request.body.userName) {
		return res.status(400).send({ message: 'must provide userName for login' })
	}

	const sql = `SELECT * FROM Users WHERE userName = ${req.body.userName}`

	db.query(sql, (err, results) => {
		if (err) {
			throw err
		}

		console.log('results: ', results)
	})
})

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`)
})
