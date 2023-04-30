/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */
const neo4j = require('neo4j-driver');

const uri = process.env.NEO4J_URI
const user = process.env.NEO4J_USER
const password = process.env.NEO4J_PASSWORD

//#####

const path = require("path");
//const fs = require('fs')

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});
const secureSession = require('@fastify/secure-session')
//const secureSession = require('fastify-secure-session')

// User Session Collecting
//const fastifySession = require('@fastify/session')
const fastifyCookie = require('@fastify/cookie')

fastify.register(fastifyCookie,{
  secret: process.env.MAGIC_KEY,
  hook: 'onRequest',
  pasreOption: {}
})

fastify.register(secureSession, {
  key: Buffer.from(process.env.COOKIE_KEY, 'utf8'), // replace with your secret key
  cookieName: 'session',
  cookie: {
    // set your cookie options
    //path: '/',
    //sameSite: false,
    secure: true // if your app is served over HTTPS
    //maxAge: 2592000000 // 30 days in milliseconds
  }
});
var sessionID


// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE
const favorites = [];
const history = [];
var bookTitle = ''

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});


// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}


/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  //const data = request.session.set('data', request.body) //Change cookie session
  //sessionID = data

  if (request.cookies['session'] == null){
    console.log('Create new user session!')
    request.session.set('data', request.body)
  }
    //console.log('Session ID:', request)
    //sessionID = request.cookies['session']
    //console.log('Session ID:', sessionID)
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };
  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor], //get color code
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */

fastify.post("/:", function (request, reply) {
  console.log('POST/')
  // Build the params object to pass to the template
  sessionID = request.cookies['session']
  let params = { seo: seo };
  
  // If the user submitted a color through the form it'll be passed here in the request body
  //let bookName = request.body.bookName;
  let color = request.body.color;
  // Test-build Neo4j Database
  
  (async() => {
    console.log('Session ID:', sessionID)
    /*
    const neo4j = require('neo4j-driver');

    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USER
    const password = process.env.NEO4J_PASSWORD
    
    */
    // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

    try {
        const bookName = color;
        //const person2Name = 'David';

        //await createFriendship(driver, person1Name, person2Name);

        const [books, booksID] = await findBooks(driver, bookName);
        //if (books) {
          //foundBooks(driver, request, booksID, bookName)
        //}

        //await findPerson(driver, person2Name);
        //console.log(bookTitles)
        if (books.length > 0) {
          // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES
          foundBooks(driver, request, booksID, bookName)
          const title = bookName;
          history.push(title);
          console.log(history);
          //console.log(books)
          params = {
            color: books[0].title,
            books: books,
            colorError: null,
            seo: seo,
          };
        }  
        else {
          params = {
            colorError: request.body.color,
            seo: seo
          }
          driver.close();
        }
    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } //finally {
        // Don't forget to close the driver connection when you're finished with it.
        //await driver.close();
    //}
    
    async function foundBooks(driver, request, booksID, bookName){
      
      sessionID = await request.cookies['session']
      //const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session = driver.session({ database: 'neo4j' });
      try{
        const readQuery1 = 'MERGE (s:Session {id: $sessionID}) \
                          ON CREATE SET s.createdAt = datetime() \
                          SET s.foundList = $booksID' 
        const readQuery2 = 'MATCH (sid:Session {id: $sessionID}) \
                          SET sid.foundList = split(coalesce(sid.foundList, ""), "|")'
        const readQuery3 = 'MATCH (sid:Session {id: $sessionID}) \
                          UNWIND sid.foundList AS bid \
                          WITH sid, bid \
                          MERGE (b:Book {id: bid}) \
                          MERGE (sid)-[:SEARCH_FOUND {foundAt: datetime(), keyword: $bookName}]->(b)'
        const readQuery4 = 'MATCH (sid:Session {id: $sessionID}) \
                          SET sid.foundList = null';
        await session.executeWrite((tx) => tx.run(readQuery1, { sessionID, booksID }));
        await session.executeWrite((tx) => tx.run(readQuery2, { sessionID, bookName}));
        await session.executeWrite((tx) => tx.run(readQuery3, { sessionID, bookName }));
        await session.executeWrite((tx) => tx.run(readQuery4, { sessionID}));
      }
      catch (error){
        console.error(`Something went wrong: ${error}`);
      }finally {
          await session.close();
      }
    }
    
    async function findBooks(driver, bookName) {
        const session = driver.session({ database: 'neo4j' });
        try {
          const readQuery = 'MATCH (a:Author)<-[:WRITTEN_BY]-(b:Book)-[:IN_GENRE]->(g:Genre) \
                            WHERE toLower(b.title) \
                            CONTAINS toLower($bookName) \
                            RETURN b.title AS title, \
                                  b.id AS id, \
                                  collect(a.name)[0..1] AS authors, \
                                  collect(g.name)[0..2] AS genres \
                                  LIMIT 30';
          const readResult = await session.executeRead((tx) => tx.run(readQuery, { bookName }));
          const books = readResult.records.map((record) => ({
            id: record.get('id'),
            title: record.get('title'),
            authors: record.get('authors'),
            genres: record.get('genres').join(', ')
          }));
          const booksID = readResult.records.map((record) => (
            parseInt(record.get('id'))
          )).join('|');
          //console.log(booksID)
          console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
          return [books, booksID];
        } catch (error) {
          console.error(`Something went wrong: ${error}`);
          return [];
        } 
      }

    //console.log('BOBO');
    return reply.view("/src/pages/index.hbs", params);
  })();
  
  //return reply.view("/src/pages/index.hbs", params);
});

// ##### Get Random
fastify.get("/random", function (request, reply) {
  console.log('POST/:random')
  // Build the params object to pass to the template
  sessionID = request.cookies['session']
  let params = {};
  (async() => {
    console.log('Session ID:', sessionID)
    // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const [books, booksID] = await getRandomBooks(driver);
    foundRandomBooks(driver, request, booksID)
    params = {
      books: books,
      random: true
    }
    
    async function getRandomBooks(driver) {
        console.log('Random!!')
        const session = driver.session({ database: 'neo4j' });
        try {
          const readQuery = 'MATCH (g:Genre)<-[:IN_GENRE]-(b:Book)-[:WRITTEN_BY]->(a:Author) \
                            RETURN b.title AS title, \
                                  b.id AS id, \
                                  collect(a.name)[0..1] AS authors, \
                                  collect(g.name)[0..2] AS genres \
                                  ORDER BY rand() \
                                  LIMIT 3';
          const readResult = await session.executeRead((tx) => tx.run(readQuery, {  }));
          const books = readResult.records.map((record) => ({
            id: record.get('id'),
            title: record.get('title'),
            authors: record.get('authors'),
            genres: record.get('genres').join(', ')
          }));
          const booksID = readResult.records.map((record) => (
            parseInt(record.get('id'))
          )).join('|');
          //console.log(booksID)
          console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
          return [books, booksID];
        } catch (error) {
          console.error(`Something went wrong: ${error}`);
          return [];
        } //finally {
          //await session.close();
        //}
      }

    async function foundRandomBooks(driver, request, booksID){
      
      sessionID = await request.cookies['session']
      //const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session = driver.session({ database: 'neo4j' });
      try{
        const readQuery1 = 'MERGE (s:Session {id: $sessionID}) \
                          ON CREATE SET s.createdAt = datetime() \
                          SET s.foundList = $booksID' 
        const readQuery2 = 'MATCH (sid:Session {id: $sessionID}) \
                          SET sid.foundList = split(coalesce(sid.foundList, ""), "|")'
        const readQuery3 = 'MATCH (sid:Session {id: $sessionID}) \
                          UNWIND sid.foundList AS bid \
                          WITH sid, bid \
                          MERGE (b:Book {id: bid}) \
                          MERGE (sid)-[:RANDOM_FOUND {foundAt: datetime()}]->(b)'
        const readQuery4 = 'MATCH (sid:Session {id: $sessionID}) \
                          SET sid.foundList = null';
        await session.executeWrite((tx) => tx.run(readQuery1, { sessionID, booksID }));
        await session.executeWrite((tx) => tx.run(readQuery2, { sessionID}));
        await session.executeWrite((tx) => tx.run(readQuery3, { sessionID }));
        await session.executeWrite((tx) => tx.run(readQuery4, { sessionID}));
      }
      catch (error){
        console.error(`Something went wrong: ${error}`);
      }finally {
          await session.close();
      }
    }
          //reply.redirect('/')
          return reply.view("/src/pages/index.hbs", params);
  })();
  //return reply.view("/src/pages/index.hbs", params);
});

// ##### Get Wishlist ######
fastify.get("/wishlist", function (request, reply) {
  let params = {};
  console.log('Displaying Wishlist');
  //return reply.view("/src/pages/wishlist.hbs", params);
  (async() => {
      sessionID = await request.cookies['session']
      console.log('Session ID:', sessionID);
      if (sessionID == null) {
        return reply.view("/src/pages/wishlist.hbs", params);
      }

      // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

      try {

          const books = await getWishlist(driver, sessionID);
          //if (books) {
            //foundBooks(driver, request, booksID, bookName)
          //}

          //await findPerson(driver, person2Name);
          //console.log(bookTitles)
          if (books.length > 0) {
            params = {
              wishlist: books,
              wishlistError: null,
            };
          }  
          else {
            params = {

            }
            driver.close();
          }
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      async function getWishlist(driver, sessionID) {
          const session = driver.session({ database: 'neo4j' });
          try {
            const readQuery = 'MATCH (s:Session {id: $sessionID})-[:WISHLIST]->(b:Book)-[:WRITTEN_BY]->(a:Author) \
                              RETURN b.title AS title, \
                                    b.id AS id, \
                                    collect(a.name)[0..1] AS authors';
            const readResult = await session.executeRead((tx) => tx.run(readQuery, { sessionID }));
            const books = readResult.records.map((record) => ({
              id: record.get('id'),
              title: record.get('title'),
              authors: record.get('authors')
            }));
            //console.log(booksID)
            console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
            return books;
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }

      //console.log('BOBO');
      return reply.view("/src/pages/wishlist.hbs", params);
    })();
  //return reply.view("/src/pages/index.hbs", params);
});


fastify.post("/wishlist", (request, reply) => {
  console.log('ADDED!');
  let bookID = request.body.bookId;
  (async() => {
      sessionID = await request.cookies['session']

      // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

      try {

          await addWishlist(driver, sessionID, bookID);
          //if (books) {
            //foundBooks(driver, request, booksID, bookName)
          //}

          //await findPerson(driver, person2Name);
          //console.log(bookTitles)
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      async function addWishlist(driver, sessionID, bookID) {
        const session = driver.session({ database: 'neo4j' });
          try {
            const writeQuery = 'MATCH (s:Session {id: $sessionID}), (b:Book {id: $bookID}) \
                              MERGE (s)-[:WISHLIST]->(b)';
            await session.executeWrite((tx) => tx.run(writeQuery, { sessionID, bookID }));
            //console.log(booksID)
            //console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }


      //console.log('BOBO');
      //return reply.view("/src/pages/wishlist.hbs", params);
    })();
  //reply.redirect('/')
})

fastify.post("/wishlist/:id", (request, reply) => {
  console.log('REMOVED!')
  let bookID = request.body.bookId;
  console.log(bookID);
  (async() => {
      sessionID = await request.cookies['session']

      // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

      try {
          await removeWishlist(driver, sessionID, bookID);
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      async function removeWishlist(driver, sessionID, bookID) {
          const session = driver.session({ database: 'neo4j' });
          try {
            const writeQuery = 'MATCH (s:Session {id: $sessionID})-[w:WISHLIST]->(b:Book {id: $bookID}) \
                              DELETE w';
            await session.executeWrite((tx) => tx.run(writeQuery, { sessionID, bookID }));
            //console.log(booksID)
            //console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }


      //console.log('BOBO');
      //return reply.view("/src/pages/wishlist.hbs");
    })();
  //reply.redirect('/wishlist')
})

// #### Test Adding Books Route ####
fastify.get("/blu3", function (request, reply) {
  let params = {};
  
  console.log('Entering blu3!');
  //return reply.view("/src/pages/wishlist.hbs", params);
  (async() => {
      sessionID = await request.cookies['session']
      console.log('Session ID:', sessionID);
    
      //if (sessionID == null) {
        //return reply.view("/src/pages/index.hbs", params);
      //}
      try {
          params = {}

          /*const books = await getWishlist(driver, sessionID);
          if (books.length > 0) {
            params = {
              wishlist: books,
              wishlistError: null,
            };
          }  
          else {
            params = {

            }
            driver.close();
          }*/
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      /*async function getWishlist(driver, sessionID) {
          const session = driver.session({ database: 'neo4j' });
          try {
            const readQuery = 'MATCH (s:Session {id: $sessionID})-[:WISHLIST]->(b:Book)-[:WRITTEN_BY]->(a:Author) \
                              RETURN b.title AS title, \
                                    b.id AS id, \
                                    collect(a.name)[0..1] AS authors';
            const readResult = await session.executeRead((tx) => tx.run(readQuery, { sessionID }));
            const books = readResult.records.map((record) => ({
              id: record.get('id'),
              title: record.get('title'),
              authors: record.get('authors')
            }));
            //console.log(booksID)
            console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
            return books;
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }*/

      //console.log('BOBO');
      return reply.view("/src/pages/addBook.hbs", params);
    })();
  //return reply.view("/src/pages/index.hbs", params);
});

fastify.post("/blu3", function (request, reply) {
  const myFunc = require('./get-book-google');
  let params = {};
  //return reply.view("/src/pages/wishlist.hbs", params);
  (async() => {
      sessionID = await request.cookies['session']
      console.log('Session ID:', sessionID);
      const isbn = request.body.isbn
    
      /*if (sessionID == null) {
        return reply.view("/src/pages/wishlist.hbs", params);
      }*/

      // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
      //const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

      try {
          params = await myFunc(isbn);

          /*const books = await getWishlist(driver, sessionID);
          if (books.length > 0) {
            params = {
              wishlist: books,
              wishlistError: null,
            };
          }  
          else {
            params = {

            }
            driver.close();
          }*/
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      /*async function getWishlist(driver, sessionID) {
          const session = driver.session({ database: 'neo4j' });
          try {
            const readQuery = 'MATCH (s:Session {id: $sessionID})-[:WISHLIST]->(b:Book)-[:WRITTEN_BY]->(a:Author) \
                              RETURN b.title AS title, \
                                    b.id AS id, \
                                    collect(a.name)[0..1] AS authors';
            const readResult = await session.executeRead((tx) => tx.run(readQuery, { sessionID }));
            const books = readResult.records.map((record) => ({
              id: record.get('id'),
              title: record.get('title'),
              authors: record.get('authors')
            }));
            //console.log(booksID)
            console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
            return books;
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }*/

      //console.log('BOBO');
      return reply.view("/src/pages/addBook.hbs", params);
    })();
  //return reply.view("/src/pages/index.hbs", params);
});

fastify.post("/blu3/:isbn", function (request, reply) {
  //return reply.view("/src/pages/wishlist.hbs", params);
  console.log('POST/blu3/:');

  const book = {isbn: request.body.isbn,
                title: request.body.title
               }
  console.log(book);
  
  (async() => {
      sessionID = await request.cookies['session']
      console.log('Session ID:', sessionID);
      
      //const isbn = request.body.isbn
    
      /*if (sessionID == null) {
        return reply.view("/src/pages/wishlist.hbs", params);
      }*/

      // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      try {
          await addNewBook(driver, sessionID, book)
          /*const books = await getWishlist(driver, sessionID);
          if (books.length > 0) {
            params = {
              wishlist: books,
              wishlistError: null,
            };
          }  
          else {
            params = {

            }
            driver.close();
          }*/
      } catch (error) {
          console.error(`Something went wrong: ${error}`);
      } //finally {
          // Don't forget to close the driver connection when you're finished with it.
          //await driver.close();
      //}

      async function addNewBook(driver, sessionID, book) {
          const session = driver.session({ database: 'neo4j' });
          console.log('ADDING BOOK!')
          try {
            console.log(book)
            /*const readQuery = 'MATCH (s:Session {id: $sessionID})-[:WISHLIST]->(b:Book)-[:WRITTEN_BY]->(a:Author) \
                              RETURN b.title AS title, \
                                    b.id AS id, \
                                    collect(a.name)[0..1] AS authors';
            const readResult = await session.executeRead((tx) => tx.run(readQuery, { sessionID }));
            const books = readResult.records.map((record) => ({
              id: record.get('id'),
              title: record.get('title'),
              authors: record.get('authors')
            }));
            //console.log(booksID)
            console.log(`Found ${books.length} books: ${books.map((book) => book.title).join(', ')}`);
            return books;*/
          } catch (error) {
            console.error(`Something went wrong: ${error}`);
            return [];
          } finally {
            await session.close();
          }
        }
      //return reply.view("/src/pages/addBook.hbs");
    })();
  //return reply.view("/src/pages/addBook.hbs");
});


  //console.log('YOLO')
  
  // If it's not empty, let's try to find the color
  /*if (color) {
    // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES
    favorites.push(color);
    console.log(favorites);

    // Load our color data file
    const colors = require("./src/colors.json");

    // Take our form submission, remove whitespace, and convert to lowercase
    color = color.toLowerCase().replace(/\s/g, "");

    // Now we see if that color is a key in our colors object
    if (colors[color]) {
      // Found one!
      params = {
        color: colors[color],
        colorError: null,
        seo: seo,
      };
    } else {
      // No luck! Return the user value as the error property
      params = {
        colorError: request.body.color,
        seo: seo,
      };
    }
  }*/

  // The Handlebars template will use the parameter values to update the page with the chosen color
  //return reply.view("/src/pages/index.hbs", params);
//});


// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
