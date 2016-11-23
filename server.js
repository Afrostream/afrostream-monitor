const Q = require('q');
const request = require('request');
const app = require('afrostream-node-app').create();
const ans = require('afrostream-node-statsd');

// initiating metrics
ans.init({
  module: 'afrostream-monitor'
});

const list = [
  // afrostream-back-end
  { url: 'https://legacy-api-orange.afrostream.tv/alive', metric: 'alive.afrostream-back-end.cdn.legacy-api-orange', type:'alive' },
  { url: 'https://legacy-api-bouygues.afrostream.tv/alive', metric: 'alive.afrostream-back-end.cdn.legacy-api-bouygues', type:'alive' },
  { url: 'https://legacy-api.afrostream.tv/alive', metric: 'alive.afrostream-back-end.cdn.legacy-api', type:'alive' },
  { url: 'https://afrostream-backend.herokuapp.com/alive', metric: 'alive.afrostream-back-end.origin', type:'alive' },
  // afrostream-api-stats
  { url: 'https://api-stats-orange.afrostream.tv/alive', metric: 'alive.afrostream-api-stats.cdn.orange', type:'alive' },
  { url: 'https://afrostream-api-stats.herokuapp.com/alive', metric: 'alive.afrostream-api-stats.origin', type:'alive' },
  // afrostream-api-v1
  { url: 'https://api.afrostream.tv/alive', metric: 'alive.afrostream-api-v1.cdn.api', type:'alive' },
  { url: 'https://afrostream-api-v1.herokuapp.com/alive', metric: 'alive.afrostream-api-v1.origin', type:'alive' },
  // afrostream (front)
  { url: 'https://www.afrostream.tv/alive', metric: 'alive.afrostream.cdn.www', type:'alive' },
  { url: 'https://afrostream.herokuapp.com/alive', metric: 'alive.afrostream.origin', type:'alive' },
  { url: 'https://beta.afrostream.tv/alive', metric: 'alive.afrostream-beta.cdn.beta', type:'alive' },
  { url: 'https://afrostream-beta.herokuapp.com/alive', metric: 'alive.afrostream-beta.origin', type:'alive' },
  // images (FIXME)
];

const status = {};

app.get('/*',(req, res) => {
  res.json(status);
});

setInterval(() => {
  list.forEach((item, i) => {
    // on n'effectue pas toutes les requêtes simultanément, on laisse quelques secondes entre elles
    setTimeout(() => {
      const { url, metric, type } = item;

      Q.nfcall(request, {uri:url, json:true, timeout: 10000})
        .then(
          ([response, body]) => {
            // should be ok, but doing somme additionnal checks
            if (!response) {
              throw new Error('no response');
            }
            if (response.statusCode !== 200) {
              console.error('[ERROR]: body='+body);
              throw new Error('statusCode '+response.statusCode);
            }
            if (type === 'alive' && body.alive !== true) {
              throw new Error('not alive');
            }
          }
        )
        // on utilise "increment" et non "gauge" au cas ou le service est down
        //   la jauge reste a 1. ca oblige a faire une dérivée dans grafana
        //   mais c'est + safe pour du checking type "alive".
        .then(
          () => {
            status[metric] = { lastCheck: new Date(), status: 'OK' };
            ans.client.increment('metric.'+metric, 1);
          },
          (err) => {
            status[metric] = { lastCheck: new Date(), status: 'ERROR', error: err.message };
            console.error('[ERROR]: ' + err.message);
          }
        );
    }, i * 3000); // N * 3sec.
  })
}, 10000)

const port = process.env.PORT || 10000
app.listen(port, () => { console.log('listening on %d', port); });
