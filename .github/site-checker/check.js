const fs = require('fs')
const path = require('path');
const { promisify } = require('util')
const jsdom = require("jsdom");
const axios = require('axios').default;

const { JSDOM } = jsdom;

function getIndexHTML() {
    return new Promise((resolve, reject) => {
        fs.readFile('../../index.html', 'utf8', function (err, data) {
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    })
}

async function getLinks(html) {
    const { document } = (new JSDOM(html)).window;
    const alllinks = Array.from(document.querySelectorAll('body > ol > li a'));
    const siteLinks = alllinks.filter(link => link.classList.length === 0);
    return siteLinks.map(link => link.getAttribute('href'));
}

const validStatusCode = (code) => code >= 200 && code < 400;

async function getStatusTotals(links) {
    const total = links.length;
    const errorMessages = [];
    const getStatus = async (link) => {
        try {
            const res = await axios.get(link);
            const valid = validStatusCode(res.status);
            if (!valid) {
                errorMessages.push(`${link} does not have a valid status code`);
                return false;
            }
            return true;
        } catch {
            errorMessages.push(`${link} cound not be reached`);
            return false;
        }
    }
    const status = await Promise.all(links.map(getStatus));
    const alive = status.filter(status => status).length;
    return {
        alive,
        total,
        errorMessages
    }
}

async function getBadge(alive, total) {
    const diff = total - alive;
    let color = 'green';
    if (diff > 0) {
        color = 'yellow';
    } 
    if (diff > 5) {
        color = 'red';
    }
    const res = await axios(`https://img.shields.io/badge/reachable%20sites-${alive}%2F${total}-${color}`);
    return res.data;
}

// main
(async function() {
    const html = await getIndexHTML();
    const links = await getLinks(html);
    const {alive, total, errorMessages} = await getStatusTotals(links);
    const badgeSvg = await getBadge(alive, total);

    const badgePath = '../../_badges/reachable-site.svg';
    const errorFilePath = '../../_badges/reachable-site-errors.txt';
    const errorMessage = errorMessages.join('\r\n');
    console.log('errorMessage', errorMessage);
    const writeFileAsync = promisify(fs.writeFile);
    const mkdirAsync = promisify(fs.mkdir);
    await mkdirAsync(path.dirname(badgePath), { recursive: true });
    await writeFileAsync(badgePath, badgeSvg);
    await writeFileAsync(errorFilePath, errorMessage);
    process.exit(0);
})()
.catch(e => {
    console.log(`Error: ${e.message}`);
    process.exit(1);
});
