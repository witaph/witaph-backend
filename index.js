const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const bodyParser = require('body-parser')

const controller = require('./controller')
const middleware = require('./middleware')
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

const app = express()

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

app.post('/api/addImage', [middleware.verifyToken], controller.addImage)
app.post('/api/images', controller.getImages)
app.get('/api/images/:imageID', controller.getImage)
app.post('/api/login', controller.login)
app.get('/api/tags', controller.getTags)
app.post('/api/updateImage', [middleware.verifyToken], controller.updateImage)
app.get('/api/verifyLogin', [middleware.verifyToken], (req, res) => {
	res.status(200).send({
		message: 'success'
	})
})

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`)
})
