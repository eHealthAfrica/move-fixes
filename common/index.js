'use strict'

import request from 'request-promise'

class Common {
  constructor (COUCHDB_URL, COUCHDB_DB) {
    this.COUCHDB_URL = COUCHDB_URL || process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'
    this.COUCHDB_DB = COUCHDB_DB || process.env.COUCHDB_DB || 'move_db'
  }

  fetchFacilities () {
    const options = {
      url: `${this.COUCHDB_URL}/${this.COUCHDB_DB}/_design/facility/_view/by-id?include_docs=true&reduce=false`,
      json: true
    }
    return request.get(options)
  }

  bulkDocs (docs) {
    const params = {
      url: `${this.COUCHDB_URL}/${this.COUCHDB_DB}/_bulk_docs`,
      json: true,
      body: {docs: docs}
    }
    return request.post(params)
  }
}

export default Common
