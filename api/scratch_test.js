import pkg from 'pg';
const { Client } = pkg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query(`SELECT "TLOid", first_name, last_name, position_title, designation FROM third_level_official_masterlist WHERE email = 'jocelyn.andaya005@deped.gov.ph'`))
  .then(res => {
    console.log(res.rows);
    client.end();
  })
  .catch(console.error);
