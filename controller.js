const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

exports.getImages = (req, res) => {
	console.log('GET /api/images')
	const sql = 'SELECT * FROM Images'

	db.query(sql, (err, results) => {
		if (err) {
			throw err
		}

		console.log('GET /api/images results: ', results)
		res.send(results)
	})
}

exports.login = (req, res) => {
	console.log('POST /api/login req.body: ', req.body)
	// console.log('POST /api/login res: ', Object.getOwnPropertyNames(res))
	if (!req.body.userName) {
		return res.status(400).send({ message: 'must provide userName for login' })
	}

	const sql = `SELECT * FROM Users WHERE userName = '${req.body.userName}'`

	db.query(sql, (err, results) => {
		if (err) {
			console.log('POST /api/login Users select err: ', err)
			throw err
		}

		console.log('POST /api/login Users select results: ', results)

		if(!results || !results.length) {
			return res.status(404).send({ message: 'user not found' })
		}

		const passwordIsValid = bcrypt.compareSync(req.body.password, results[0].password)
		if (!passwordIsValid) {
			return res.status(401).send({ message: 'invalid password' })
		}

		const token = jwt.sign(
			{ id: results[0].userName },
			process.env.JWT_SECRET,
			{ expiresIn: 86400 } // 24 hrs
		)

		res.status(200).send({
			accessToken: token
		})
	})
}

const addImage = (req, res) => {
	console.log('POST /api/addImage req.body: ', req.body)
	console.log('POST /api/addImage req.userName: ', req.userName)
}