const express = require('express')
const mysql = require('mysql2')
const dotenv = require('dotenv').config()

const PORT = process.env.port || 8000

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

app.get('/images', (req, res) => {
	let sql = 'SELECT * FROM Images'

	db.query(sql, (err, results) => {
		if (err) {
			throw err
		}

		console.log('GET /images results: ', results)
		res.send(results)
	})
})

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`)
})
