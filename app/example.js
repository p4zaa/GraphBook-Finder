(async() => {
    const neo4j = require('neo4j-driver');

    const uri = 'neo4j+s://e682bcb5.databases.neo4j.io';
    const user = 'neo4j';
    const password = 'eh-vWnZb73QmxgTK33EsJnEj4yT78KCAVuz3-HAJ7Rg';
    
    // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

    try {
        const bookName = "Medusa's Child";
        //const person2Name = 'David';

        //await createFriendship(driver, person1Name, person2Name);

        await findBook(driver, bookName);
        //await findPerson(driver, person2Name);
    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        // Don't forget to close the driver connection when you're finished with it.
        await driver.close();
    }

    /*async function createFriendship (driver, person1Name, person2Name) {

        // To learn more about sessions: https://neo4j.com/docs/javascript-manual/current/session-api/
        const session = driver.session({ database: 'neo4j' });

        try {
            // To learn more about the Cypher syntax, see: https://neo4j.com/docs/cypher-manual/current/
            // The Reference Card is also a good resource for keywords: https://neo4j.com/docs/cypher-refcard/current/
            const writeQuery = `MERGE (p1:Person { name: $person1Name })
                                MERGE (p2:Person { name: $person2Name })
                                MERGE (p1)-[:KNOWS]->(p2)
                                RETURN p1, p2`;

            // Write transactions allow the driver to handle retries and transient errors.
            const writeResult = await session.executeWrite(tx =>
                tx.run(writeQuery, { person1Name, person2Name })
            );

            // Check the write results.
            writeResult.records.forEach(record => {
                const person1Node = record.get('p1');
                const person2Node = record.get('p2');
                console.info(`Created friendship between: ${person1Node.properties.name}, ${person2Node.properties.name}`);
            });

        } catch (error) {
            console.error(`Something went wrong: ${error}`);
        } finally {
            // Close down the session if you're not using it anymore.
            await session.close();
        }
    }*/

    async function findBook(driver, bookName) {

        const session = driver.session({ database: 'neo4j' });

        try {
            const readQuery = `MATCH (b:Book)
                            WHERE b.title = $bookName
                            RETURN b.title AS title`;
            
            const readResult = await session.executeRead(tx =>
                tx.run(readQuery, { bookName })
            );
            //console.log(readResult.records)
            readResult.records.forEach(record => {
                console.log(`Found book: ${record.get('title')}`)
            });
        } catch (error) {
            console.error(`Something went wrong: ${error}`);
        } finally {
            await session.close();
        }
    }
})();
