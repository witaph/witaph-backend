const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2')
const moment = require('moment')
const util = require('util')

const db = mysql.createPool({
	connectionLimit: 10,
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
})

const query = util.promisify(db.query).bind(db)

const addImage = async (req, res) => {
	console.log('POST /api/addImage req.body: ', req.body)

	if (!req.body.sourceURL || !req.body.sourceURL.length) {
		return res.status(400).send({ message: 'must provide sourceURL' })
	}

	if (!req.body.dateCaptured || !req.body.dateCaptured.length) {
		return res.status(400).send({ message: 'must provide dateCaptured (YYYY-MM-DD)' })
	}

	const dateCapturedMoment = moment(req.body.dateCaptured, 'YYYY-MM-DD')
	if (!dateCapturedMoment.isValid()) {
		return res.status(401).send({ message: 'dateCaptured must be in YYYY-MM-DD format' })
	}

	const imageValues = {
		name: (req.body.name && req.body.name.length) ? req.body.name : null,
		sourceURL: req.body.sourceURL,
		sourceURL2: (req.body.sourceURL2 && req.body.sourceURL2.length) ? req.body.sourceURL2 : null,
		state: (req.body.captureState && req.body.captureState.length) ? req.body.captureState : null,
		country: (req.body.captureCountry && req.body.captureCountry.length) ? req.body.captureCountry : null,
		dateCaptured: dateCapturedMoment.format('YYYY-MM-DD'),
	}

	const imageInsert = 'INSERT INTO Images (name, sourceURL, sourceURL2, state, country, dateCaptured) '
		+ 'VALUES (?, ?, ?, ?, ?, ?)'
	const imageInsertParams = [imageValues.name, imageValues.sourceURL, imageValues.sourceURL2, imageValues.state, imageValues.country, imageValues.dateCaptured]

	console.log('imageInsertParams: ', imageInsertParams)
	
	const imageInsertResult = await query(imageInsert, imageInsertParams)
	console.log('imageInsertResult: ', imageInsertResult)

	const imageTagRecords = await addTags(imageInsertResult.insertId, req.body.tags)
	console.log('imageTagRecords: ', imageTagRecords)

	const allTags = await query('SELECT * FROM Tags')
	console.log('allTags: ', allTags)

	res.send(allTags)
}

const addTags = async (imageID, tags) => {
	// insert new tags
	const tagsWithIds = await Promise.all(tags.map(async tag => {
		if (!tag.id) {
			const tagInsert = 'INSERT INTO Tags (tagText) VALUES (?)'
			const tagInsertParams = [tag.name]
			console.log('tag insert params: ', tagInsertParams)
			const tagInsertResult = await query(tagInsert, tagInsertParams)
			return {
				id: tagInsertResult.insertId,
				name: tag.name,
			}
		} else {
			return tag
		}
	}))
	console.log('tagsWithIds: ', tagsWithIds)

	const imageTagsSelect = 'SELECT * FROM ImageTags WHERE imageID = ?'
	const imageTagsParams = [imageID]
	const imageTags = await query(imageTagsSelect, imageTagsParams)
	const existingImageTagIds = imageTags.map(tag => tag.tagID)

	// create ImageTags records for any tags not already applied to the image
	await Promise.all(tagsWithIds.map(async tag => {
		console.log('tag: ', tag)
		if (!existingImageTagIds.includes(tag.id)) {
			const imageTagInsert = 'INSERT INTO ImageTags (imageID, tagID) VALUES (?, ?)'
			const imageTagInsertParams = [imageID, tag.id]
			console.log('imageTagInsert: ', imageTagInsert)
			const imageTagInsertResult = await query(imageTagInsert, imageTagInsertParams)
			imageTags.push({
				imageID,
				tagID: tag.id,
				newlyInserted: true,
			})
		}
	}))

	return imageTags
}

const getImage = async (req, res) => {
	console.log(`GET /api/images/${req.params.imageID}`)

	const imageSelect = 'SELECT * FROM Images WHERE imageID = ?'
	const imageSelectParams = [req.params.imageID]
	const images = await query(imageSelect, imageSelectParams)
	if (!images || !images.length) {
		res.status(404).send({ message: 'image not found' })
	}
	const image = images[0]

	const tagSelect = 'SELECT * FROM ImageTags INNER JOIN Tags on ImageTags.TagID = Tags.TagID WHERE ImageTags.imageID = ?'
	const tags = await query(tagSelect, imageSelectParams)

	console.log('image: ', image)
	console.log('tags: ', tags)

	res.send({
		...image,
		tags: tags.map(tag => ({
			id: tag.tagID,
			name: tag.tagText,
		}))
	})
}

const getImages = async (req, res) => {
	console.log('POST /api/images, req.body: ', req.body)
	let imageSelect = 'SELECT * FROM Images INNER JOIN ImageTags ON Images.imageID = ImageTags.imageID INNER JOIN Tags ON ImageTags.tagID = Tags.tagID'
	const imageSelectParams = []

	let hasWhere = false

	if (req.body.tags && req.body.tags.length) {
		let imageTagSelect = 'SELECT '
		const imageTagSelectParams = []
		if (req.body.whichTags == 'any') {
			imageTagSelect += 'DISTINCT imageID FROM ImageTags WHERE tagID IN (?'
			imageTagSelectParams.push(req.body.tags[0].id)
			for (let i = 1; i < req.body.tags.length; i++) {
				imageTagSelect += ',?'
				imageTagSelectParams.push(req.body.tags[i].id)
			}
			imageTagSelect += ')'
		} else { // only return images with all tags
			imageTagSelect += 'imageID FROM ImageTags WHERE tagID IN (?'
			imageTagSelectParams.push(req.body.tags[0].id)
			for (let i = 1; i < req.body.tags.length; i++) {
				imageTagSelect += ',?'
				imageTagSelectParams.push(req.body.tags[i].id)
			}
			imageTagSelect += ') GROUP BY imageID HAVING COUNT(*) = ?'
			imageTagSelectParams.push(req.body.tags.length)
		}
		console.log('imageTagSelect: ', imageTagSelect)
		console.log('imageTagSelectParams: ', imageTagSelectParams)

		const imagesTagged = await query(imageTagSelect, imageTagSelectParams)
		console.log('imagesTagged: ', imagesTagged)

		hasWhere = true
		imageSelect += ' WHERE Images.imageID in (?'
		imageSelectParams.push(imagesTagged[0].imageID)
		for (let i = 1; i < imagesTagged.length; i++) {
			imageSelect += ',?'
			imageSelectParams.push(imagesTagged[i].imageID)
		}
		imageSelect += ')'
	}

	if (req.body.capturedAfter && req.body.capturedAfter.length) {
		if (hasWhere) {
			imageSelect += ' AND '
		} else {
			imageSelect += ' WHERE '
			hasWhere = true
		}

		imageSelect += 'dateCaptured >= ?'
		imageSelectParams.push(req.body.capturedAfter)
	}

	if (req.body.capturedBefore && req.body.capturedBefore.length) {
		if (hasWhere) {
			imageSelect += ' AND '
		} else {
			imageSelect += ' WHERE '
			hasWhere = true
		}

		imageSelect += 'dateCaptured <= ?'
		imageSelectParams.push(req.body.capturedBefore)
	}

	if (req.body.captureState && req.body.captureState.length) {
		if (hasWhere) {
			imageSelect += ' AND '
		} else {
			imageSelect += ' WHERE '
			hasWhere = true
		}

		imageSelect += 'state = ?'
		imageSelectParams.push(req.body.captureState)
	}

	imageSelect += ' ORDER BY dateCaptured DESC, Images.imageID DESC'
	console.log('imageSelect: ', imageSelect)
	console.log('imageSelectParams: ', imageSelectParams)

	const imagesRaw = await query(imageSelect, imageSelectParams)
	console.log('images query results: ', imagesRaw)
	const images = convertImageTags(imagesRaw)
	console.log('POST /api/images results: ', images)
	res.send(images)
}

// take result of joining images with tags and convert to one row per image with
// tags for each image as an array property
const convertImageTags = rows => {
	let lastImageID;
	const convertedRows = []
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		if (row.imageID !== lastImageID) {
			lastImageID = row.imageID
			const convertedRow = {
				imageID: row.imageID,
				dateCreated: row.dateCreated,
				name: row.name,
				sourceURL: row.sourceURL,
				sourceURL2: row.sourceURL2,
				state: row.state,
				country: row.country,
				dateCaptured: row.dateCaptured,
				tags: []
			}
			if (row.tagText) {
				convertedRow.tags.push(row.tagText)
			}
			convertedRows.push(convertedRow)
		} else {
			convertedRows[convertedRows.length - 1].tags.push(row.tagText)
		}
	}
	return convertedRows
}

const login = async (req, res) => {
	console.log('POST /api/login req.body: ', req.body)
	
	if (!req.body.userName) {
		return res.status(400).send({ message: 'must provide userName for login' })
	}

	const userSelect = 'SELECT * FROM Users WHERE userName = ?'
	const userSelectParams = [req.body.userName]

	const users = await query(userSelect, userSelectParams)
	console.log('POST /api/login Users select results: ', users)

	if (!users || !users.length) {
		return res.status(404).send({ message: 'user not found' })
	}

	const passwordIsValid = bcrypt.compareSync(req.body.password, users[0].password)
	if (!passwordIsValid) {
		return res.status(401).send({ message: 'invalid password' })
	}

	const token = jwt.sign(
		{ id: users[0].userName },
		process.env.JWT_SECRET,
		{ expiresIn: 86400 } // 24 hrs
	)

	res.status(200).send({
		accessToken: token
	})
}

const getTags = async (req, res) => {
	console.log('GET /api/tags')
	const tagSelect = 'SELECT * FROM Tags'

	const tags = await query(tagSelect)

	console.log('GET /api/tags results: ', tags)
	res.send(tags)
}

const updateImage = async (req, res) => {
	console.log('POST /api/updateImage, req.body: ', req.body)

	if (!req.body.imageID) {
		return res.status(400).send({ message: 'must provide imageID '})
	}

	if (!req.body.sourceURL || !req.body.sourceURL.length) {
		return res.status(400).send({ message: 'must provide sourceURL' })
	}

	if (!req.body.dateCaptured || !req.body.dateCaptured.length) {
		return res.status(400).send({ message: 'must provide dateCaptured (YYYY-MM-DD)' })
	}

	const dateCapturedMoment = moment(req.body.dateCaptured, 'YYYY-MM-DD')
	if (!dateCapturedMoment.isValid()) {
		return res.status(401).send({ message: 'dateCaptured must be in YYYY-MM-DD format' })
	}

	const existingImageSelect = 'SELECT * FROM Images WHERE imageID = ?'
	const imageSelectParams = [req.body.imageID]
	const existingImage = await query(existingImageSelect, imageSelectParams)
	if (!existingImage.length) {
		return res.status(404),send({ message: 'no image with that id found' })
	}

	const imageValues = {
		imageID: req.body.imageID,
		name: (req.body.name && req.body.name.length) ? req.body.name : null,
		sourceURL: req.body.sourceURL,
		sourceURL2: (req.body.sourceURL2 && req.body.sourceURL2.length) ? req.body.sourceURL2 : null,
		state: (req.body.captureState && req.body.captureState.length) ? req.body.captureState : null,
		country: (req.body.captureCountry && req.body.captureCountry.length) ? req.body.captureCountry : null,
		dateCaptured: dateCapturedMoment.format('YYYY-MM-DD'),
	}

	const imageUpdate = 'UPDATE Images SET '
		+ 'name=?, sourceURL=?, sourceURL2=?, state=?, country=?, dateCaptured=?'
		+ 'WHERE imageID=?'
	const imageUpdateParams = [imageValues.name, imageValues.sourceURL, imageValues.sourceURL2, imageValues.state, imageValues.country, imageValues.dateCaptured, imageValues.imageID]

	console.log('imageUpdateParams: ', imageUpdateParams)
	
	const imageUpdateResult = await query(imageUpdate, imageUpdateParams)
	console.log('imageUpdateResult: ', imageUpdateResult)

	// add new tags
	const imageTagRecords = await addTags(imageValues.imageID, req.body.tags)
	console.log('imageTagRecords: ', imageTagRecords)

	const requestTagIds = []
	req.body.tags.map(tag => !!tag.id && requestTagIds.push(tag.id))
	console.log('requestTagIds: ', requestTagIds)

	// remove any tags not included in request
	await Promise.all(imageTagRecords.map(async imageTag => {
		if(!requestTagIds.includes(imageTag.tagID) && !imageTag.newlyInserted) {
			console.log(`deleting ImageTags with imageID: ${imageTag.imageID}, tagID: ${imageTag.tagID}`)
			const imageTagDelete = 'DELETE FROM ImageTags WHERE imageID = ? AND tagID = ?'
			const imageTagDeleteParams = [imageTag.imageID, imageTag.tagID]
			const imageTagDeleteResult = await query(imageTagDelete, imageTagDeleteParams)
			console.log('imageTagDeleteResult: ', imageTagDeleteResult)
		}
	}))

	const allTags = await query('SELECT * FROM Tags')
	console.log('allTags: ', allTags)

	res.send(allTags)
}

module.exports = {
	db,
	getImage,
	getImages,
	login,
	addImage,
	getTags,
	updateImage,
}