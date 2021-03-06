const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
	console.log('verifyToken, req.headers: ', req.headers)
	const token = req.headers['x-access-token']
	if (!token) {
		return res.status(200).send({
			message: 'no access token provided'
		})
	}

	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		if (err) {
			return res.status(200).send({
				message: 'unauthorized'
			})
		}
		req.userName = decoded.id
		next()
	})
}

module.exports = {
	verifyToken: verifyToken
}