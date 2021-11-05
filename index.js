const cheerio = require('cheerio')
const URL = require('url').URL

const GET = 'GET'
const POST = 'POST'
const HTTP_VERSION = 'HTTP/1.1'
const DOMAIN = 'www.3700.network'
const CHUNKED = 'Transfer-Encoding: chunked'
const HOST_HEADER = 'Host: www.3700.network'

function parseHTTPResponse(resp) {
	const lines = resp.split(/\r?\n/)

	// handle first line
	const firstLine = lines[0]
	const splitFirstLine = firstLine.split(' ')
	if (splitFirstLine !== HTTP_VERSION) {
		console.log('response is not HTTP/1.1')
	}
	const statusCode = splitFirstLine[1]

	const isChunked = !!lines.find((l) => l == CHUNKED)
	let body = ''
	const indexOfEmptyLine = lines.indexOf('')

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

	return { statusCode, body }
}

function getHtmlFromUrl(url) {
	const urlObject = new URL(url)
	const path = urlObject.pathname + urlObject.search
	// connect to socket, make request, and call onData

	const onData = (data) => {
		console.log('data', data.toString())
		const { statusCode, body } = parseHTTPResponse(data.toString())

		if (statusCode === '200') {
			// everything is ok, extract the html
		} else if (statusCode === '302') {
			// redirect to url in Location header
		} else if (statusCode === '403' || statusCode === '404') {
			// abandon url
		} else if (statusCode === '500') {
			// retry url
		}
	}
}

function getUrlsFromHtml(html) {
	const $ = cheerio.load(html)
	return [].filter((url) => new URL(url).host === DOMAIN)
}

function getSecretFlagsFromHtml(html) {
	const $ = cheerio.load(html)
	return []
}

function crawl() {
	const stack = [] // stack of urls
	const visited = new Set() // url has been visited or is about to be visited (is in the stack)

	while (stack.length != 0) {
		const url = stack.pop()

		// get and parse url html
		const html = getHtmlFromUrl(url)
		const links = getUrlsFromHtml(html)
		const secrets = getSecretFlagsFromHtml(html)

		for (const secret of secrets) {
			console.log(secret)
		}

		for (const link of links) {
			if (!visited.has(link)) {
				visited.add(link)
				stack.push(link)
			}
		}
	}
}