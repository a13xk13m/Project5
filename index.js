const cheerio = require('cheerio')
const tls = require('tls')

const GET = 'GET'
const POST = 'POST'
const HTTP_VERSION = 'HTTP/1.1'
const CHUNKED = 'Transfer-Encoding: chunked'
const HOST_HEADER = 'Host: fakebook.3700.network'

const args = process.argv.slice(2)
const username = args[0]
const password = args[1]

function parseHTTPResponse(resp) {
	const lines = resp.split(/\r?\n/)

	// handle first line
	const firstLine = lines[0]
	const splitFirstLine = firstLine.split(' ')
	if (splitFirstLine[0] !== HTTP_VERSION) {
		console.log('response is not HTTP/1.1')
	}
	const statusCode = splitFirstLine[1]

	const isChunked = !!lines.find((l) => l === CHUNKED)
	let body = ''
	const indexOfEmptyLine = lines.indexOf('')

	const headersList = lines.slice(1, indexOfEmptyLine)
	const headers = {}
	headersList.forEach((header) => {
		const split = header.split(': ')
		if (split[0] === 'Set-Cookie') {
			// split up the Set-Cookie header by each equal statement, save csrf token in headers object
			const newKey = split[1].slice(0, split[1].indexOf('='))
			const newValue = split[1].slice(split[1].indexOf('=') + 1, split[1].indexOf(';'))
			headers[newKey] = newValue
		} else {
			headers[split[0]] = split[1]
		}
	})

	// handle body
	if (isChunked) {
		let onLengthLine = true
		for (let i = indexOfEmptyLine + 1; i < lines.length; i++) {
			if (onLengthLine) {
				const length = parseInt(lines[i].split(';')[0], 16) // in hex
				if (length === 0) {
					break
				}
			} else {
				body += lines[i]
			}
			onLengthLine = !onLengthLine
		}
	} else {
		body = lines.slice(indexOfEmptyLine + 1).join('')
	}

	return { statusCode, headers, body }
}

function getHtmlFromUrl(url) {
	return new Promise((resolve) => {
		client = tls.connect(443, 'fakebook.3700.network', { rejectUnauthorized: false }, () => {})
		// make request
		const cookieHeader = `Cookie: csrftoken=${csrftoken}; sessionid=${sessionId}`

		const onCrawlData = (data) => {
			const { statusCode, headers, body } = parseHTTPResponse(data.toString())
			sessionId = headers.sessionid ?? sessionId
			client.off('data', onCrawlData)

			if (statusCode === '200') {
				// everything is ok, extract the html
				resolve({ html: body })
			} else if (statusCode === '302') {
				// redirect to url in Location header
				resolve({ url: headers.Location })
			} else if (statusCode === '403' || statusCode === '404') {
				// abandon url
				resolve(undefined)
			} else if (statusCode === '500') {
				// retry url
				client.write(`${GET} ${url} ${HTTP_VERSION}\n${HOST_HEADER}\n${cookieHeader}\n\n`)
			}
			client.destroy()
		}

		client.on('data', onCrawlData)
		client.on('error', (error) => {
			console.log('error', error)
		})
		client.write(`${GET} ${url} ${HTTP_VERSION}\n${HOST_HEADER}\n${cookieHeader}\n\n`)
	})
}

function getUrlsAndSecretFlagsFromHtml(html) {
	const $ = cheerio.load(html)
	const urls = []
	$('a').each((i, el) => {
		// make sure that the url has the correct domain name
		if (el.attribs.href.startsWith('/')) {
			urls.push(el.attribs.href)
		}
	})

	const flags = []
	// extract the secret flag
	$('h2.secret_flag').each((i, el) => {
		flags.push(el.children[0].data)
	})

	return { urls, flags }
}

let csrftoken = ''
let sessionId = ''

// initial connection
let client = tls.connect(443, 'fakebook.3700.network', { rejectUnauthorized: false }, () => {
	client.write(`${GET} /accounts/login/?next=/fakebook/ ${HTTP_VERSION}\n${HOST_HEADER}\n\n`)
})

let getHtml = true
let doneLogin = false

const onLoginData = (data) => {
	if (getHtml) {
		// login to fakebook
		const { statusCode, headers, body } = parseHTTPResponse(data.toString())
		const $ = cheerio.load(body)
		const { value } = $('input[name=csrfmiddlewaretoken]').get(0).attribs
		const cookie = headers['csrftoken']
		const requestBody = `username=${username}&password=${password}&csrfmiddlewaretoken=${value}&next=%2Ffakebook%2F`
		const postRequest = `${POST} /accounts/login/ ${HTTP_VERSION}\n${HOST_HEADER}\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${requestBody.length}\nCookie: csrftoken=${cookie}\n\n${requestBody}`
		client.write(postRequest)
		getHtml = false
	} else if (!doneLogin) {
		// POST request response
		const { statusCode, headers, body } = parseHTTPResponse(data.toString())
		sessionId = headers.sessionid
		csrftoken = headers.csrftoken
		// run crawler
		crawl()
		doneLogin = true
	}
}

let onData = onLoginData

client.on('data', onData)

async function crawl() {
	const stack = ['/fakebook/'] // stack of urls
	const visited = new Set() // url has been visited or is about to be visited (is in the stack)
	visited.add('/fakebook/')

	while (stack.length != 0) {
		const url = stack.pop()

		// get and parse url html
		const result = await getHtmlFromUrl(url)
		if (!result) continue
		const { html, url: redirectUrl } = result
		if (html) {
			const { urls: links, flags: secrets } = getUrlsAndSecretFlagsFromHtml(html)

			for (const secret of secrets) {
				const splitSecret = secret.split(' ')
				console.log(splitSecret[1])
			}

			for (const link of links) {
				if (!visited.has(link)) {
					visited.add(link)
					stack.push(link)
				}
			}
		} else if (redirectUrl) {
			if (!visited.has(redirectUrl)) {
				visited.add(redirectUrl)
				stack.push(redirectUrl)
			}
		}
	}
}
