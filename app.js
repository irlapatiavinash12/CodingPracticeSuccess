const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())
let db = null

const initialisedbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB server error:${e.message}`)
    process.exit(1)
  }
}

initialisedbServer()

//Authentication
const authenticateToken = async (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

const dbObjectToResponseObject = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}

const dbObjectToResponseObject1 = dbobject => {
  return {
    districtId: dbobject.district_id,
    districtName: dbobject.district_name,
    stateId: dbobject.state_id,
    cases: dbobject.cases,
    cured: dbobject.cured,
    active: dbobject.active,
    deaths: dbobject.deaths,
  }
}
//POST API logins the user
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    console.log(isPasswordMatched)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 2 GET returns all the states
app.get('/states/', authenticateToken, async (request, response) => {
  const selectStateQuery = `
  SELECT * FROM
  state`
  const dbresponse = await db.all(selectStateQuery)
  response.send(dbresponse.map(element => dbObjectToResponseObject(element)))
})

//API 3 GET returns a specific state

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getSelectedQuery = `
  SELECT * 
  FROM 
  state
  WHERE 
  state_id = ${stateId}`
  const dbresponse = await db.get(getSelectedQuery)
  response.send(dbObjectToResponseObject(dbresponse))
})

//API 4 POST inserts a new row in the database

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `
  INSERT INTO
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`
  const dbresponse = await db.run(postQuery)
  response.send('District Successfully Added')
})

//API 5 GET API returns a specific district bsed on the id

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getSelectQuery = `
  SELECT *
  FROM 
  district 
  WHERE 
  district_id = ${districtId};`
    const dbresponse = await db.get(getSelectQuery)
    response.send(dbObjectToResponseObject1(dbresponse))
  },
)

//API 6 DELETE  deletes the specific district
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
  DELETE 
  FROM 
  district
  WHERE 
  district_id = ${districtId};`
    const dbresponse = await db.run(deleteQuery)
    response.send('District Removed')
  },
)

//API 7 PUT API updates the details of the district
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `
  UPDATE 
  district
  SET 
   district_name = '${districtName}',
   state_id = ${stateId},
   cases = ${cases},
   cured = ${cured},
   active = ${active},
   deaths = ${deaths};`
    const dbresponse = await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

//API 8 GET returns the total cases of the specific state

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM 
  district 
  WHERE 
  state_id = ${stateId};`
    const stats = await db.get(getQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
