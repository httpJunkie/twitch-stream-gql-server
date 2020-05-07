require('dotenv').config()
const { user, pass } = process.env

const express = require('express')
const graphqlHTTP = require('express-graphql')
const { buildSchema } = require('graphql')
const couchbase = require('couchbase')

const app = express()
const cluster = new couchbase.Cluster('couchbase://localhost', {
  username: user,
  password: pass
})
const bucket = cluster.bucket('travel-sample')
const collection = bucket.defaultCollection()

const schema = buildSchema(`
  type Query {
    airlinesByCountry(country: String!): [Airline]
    airportsByCountry(country: String!): [Airport]
    airlineByKey(id: Int!): Airline
  }
  type Airline {
    id: Int,
    callsign: String,
    country: String,
    iata: String,
    icao: String,
    name: String,
    type: String,
    docKey: String
  }
  type Airport {
    airportname: String,
    city: String,
    country: String,
    faa: String,
    geo: Geo,
    icao: String,
    id: Int,
    type: String,
    tz: String
  }
  type Geo {
    alt: Int,
    lat: Float,
    lon: Float
  }
`)

const root = {
  airportsByCountry: (data) => {
    let statement =`
    SELECT id, type, airportname, city, country, faa, geo, icao, tz
    FROM \`travel-sample\`
    WHERE type = 'airport'
    AND country = $COUNTRY
    `
    return new Promise((resolve, reject) => {
      let options = { parameters: {COUNTRY: data.country} }
      cluster.query(
        statement, options, (error, result) => error 
          ? reject(error) 
          : resolve(result.rows)
      )
    }).catch(e => console.error(e))
  },
  airlinesByCountry: (data) => {
    let statement =`
    SELECT id, type, callsign, country, iata, icao, name,
    FROM \`travel-sample\`
    WHERE type = 'airline'
    AND country = $COUNTRY
    `
    return new Promise((resolve, reject) => {
      let options = { parameters: {COUNTRY: data.country} }
      cluster.query(
        statement, options, (error, result) => error 
          ? reject(error) 
          : resolve(result.rows)
      )
    }).catch(e => console.error(e))
  },
  airlineByKey: (data) => {
    let dbkey = "airline_" + data.id
    return new Promise((resolve, reject) => {
      collection.get(
        dbkey, (error, result) => error 
          ? reject(error) 
          : resolve(result.value)
      )
    }).catch(e => console.error(e))
  }
}

const serverUrl = `/graphql`
const serverPort = 4000

app.use(serverUrl, graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true
}))

app.listen(serverPort, () => {
  let message = `GraphqQL server has started on http://localhost:${serverPort}${serverUrl}`
  console.log(message)
})