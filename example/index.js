const API_GW = require('../')

const api_gw = new API_GW('./serverless.yml',
  {
    service: { x_api_key: "bob" },
    yaml: {
      context: {
        opt: (x) => {
          switch (x[0]) {
            case 'stage':
              return 'local';
            default:
              return x[1];
          }
        }
      }
    }
  });


api_gw.serve(({httpPort, wsPort}) => { console.log(`listening http on ${httpPort} and ws on ${wsPort}`); });
