'use strict'

const request = require('request-promise')
const randomize = require('randomatic')
const fs = require('fs')
const path = require('path')

const instance = null
const LOCAL_CSV_FILE = path.resolve('./user-list-{date}.csv')

class UsersMgr {
  constructor () {
    this.COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'
    this.BASE_URL = `${this.COUCHDB_URL}/_users`
    this.USER_ID_PREFIX = 'org.couchdb.user'
    this.csvDoc = ['username,password,email']
    this.indexedUsers = {}
  }

  resetCSVDoc () {
    this.csvDoc = ['username,password,email']
  }

  fetch () {
    const params = {
      url: `${this.BASE_URL}/_all_docs?include_docs=true`,
      json: true
    }
    return request.get(params)
  }

  bulkDocs (bulkDocs) {
    const params = {
      url: `${this.BASE_URL}/_bulk_docs`,
      json: true,
      body: {docs: bulkDocs}
    }
    return request.post(params)
  }

  extractUsers () {
    this.resetCSVDoc()
    return this.fetch()
      .then(users => {
        return users.rows.filter(row => {
          return row.id.indexOf('_design') === -1 &&
            (row.id.indexOf('zcco.') !== -1 || row.id.indexOf('wto.') !== -1 || row.id.indexOf('hf.') !== -1)
        })
          .map(row => {
            let doc = row.doc
            let name = doc._id.split(':')[1].split(/[_@.]+/)
            const oldId = doc._id
            doc.name = `${name[0]}.${name[1]}`
            doc._id = `${this.USER_ID_PREFIX}:${doc.name}`
            if (oldId !== doc._id) {
              delete doc._rev
            }
            doc.password = randomize('?', 4, {chars: 'abcdefghjkmnpqrstuvwxyz0123456789'})
            this.csvDoc.push(`${doc.name},${doc.password},${doc.email} `)
            return doc
          })
      })
  }

  createOrUpdateUsers () {
    return this.extractUsers()
      .then(userDocs => {
        console.log(`pushing all docs to ${this.BASE_URL}`)
        return this.bulkDocs(userDocs)
      })
      .then((serverResponse) => {
        if (serverResponse.length > 0) {
          const filePath = LOCAL_CSV_FILE.replace('{date}', new Date().toJSON())
          console.log(`saving records to ${filePath}`)
          fs.writeFileSync(filePath, this.csvDoc.join('\n'))
          this.resetCSVDoc()
          return serverResponse
        }
        console.log(`nothing to save here`)
        return []
      })
  }

  static getInstance () {
    if (instance) {
      return instance
    }
    return new UsersMgr()
  }
}

const userMgr = UsersMgr.getInstance()

userMgr.createOrUpdateUsers()
  .then(users => {
    console.log(JSON.stringify(users, null, 2))
  })
  .catch(error => {
    console.error(error.message)
  })

module.exports = UsersMgr
