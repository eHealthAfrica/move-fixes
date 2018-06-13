const _ = require('lodash')
const request = require('request-promise')
const Promise = require('bluebird')

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'
const productLevels = require('./resources/product-level.json')

if (!process.env.COUCHDB_URL) {
  console.log(
    `
    No COUCHDB_URL provided defaulting to ${COUCHDB_URL}
    url format without auth http(s)//x.x.x.x(:5984)
    with auth http(s)//username:password@x.x.x.x(:5984)
    `
  )
}

const fetchFacilityProgramProducts = () => {
  const query = {
    limit: 100000,
    selector: {
      doc_type: {
        $eq: 'facility-program-product'
      },
      minLevel: {
        $eq: 0
      },
      maxLevel: {
        $eq: 0
      },
      reorderLevel: {
        $eq: 0
      }
    }
  }
  const params = {
    url: `${COUCHDB_URL}/move_db/_find/`,
    method: 'POST',
    body: query,
    json: true
  }
  return request.post(params)
}

const updateMaxMinReorderLevels = (defaultMaxMinReorderLevels, allFacilityProgramProductsWithout) => {
  const updates = []
  const length = allFacilityProgramProductsWithout.length
  for (let i = 0; i < length; i++) {
    const facilityProgramProduct = allFacilityProgramProductsWithout[i]
    const productType = defaultMaxMinReorderLevels[(facilityProgramProduct || {}).productType]
    const facilityProductLevels = productLevels[facilityProgramProduct.facility] || {}
    let typeName = facilityProgramProduct.productType.replace('product-type:', '')
    typeName = typeName === 's/box' ? 'safety-boxes' : typeName

    if (facilityProductLevels[typeName]) {
      facilityProgramProduct.minLevel = facilityProductLevels[typeName].min
      facilityProgramProduct.maxLevel = facilityProductLevels[typeName].max
      facilityProgramProduct.reorderLevel = facilityProductLevels[typeName].reorderLevel
      updates.push(facilityProgramProduct)
    } else if (productType) {
      facilityProgramProduct.minLevel = productType ? productType.minLevel : 0
      facilityProgramProduct.maxLevel = productType ? productType.maxLevel : 0
      facilityProgramProduct.reorderLevel = productType ? productType.reorderLevel : 0
      updates.push(facilityProgramProduct)
    }
  }
  return updates
}

const props = {
  productTypes: require('./default-product-type-min-max-reorder.json'),
  facilityProgramProducts: fetchFacilityProgramProducts()
}

Promise.props(props)
  .then(responseData => {
    const productTypesById = _.keyBy(responseData.productTypes.docs, '_id')
    const facilityProgramProducts = updateMaxMinReorderLevels(productTypesById, responseData.facilityProgramProducts.docs)
    console.log(`Number to facility-program-products to update...${facilityProgramProducts.length}`)
    if (facilityProgramProducts.length > 0) {
      return request.post({url: `${COUCHDB_URL}/move_db/_bulk_docs`, body: {docs: facilityProgramProducts}, json: true})
    }
    return Promise.resolve([])
  })
  .then(response => {
    // console.log(JSON.stringify(response, null, 2))
    console.log(`total of ${response.length} was updated`)
  })
  .catch(error => console.error(error))
