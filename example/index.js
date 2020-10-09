const fakeaws = require('../')

let x = new fakeaws('./serverless.yml',
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


x.serve(({httpPort, wsPort}) => { console.log(`listening http on ${httpPort} and ws on ${wsPort}`); });
