import { VaultClient, AuthInfo } from './vault-client-src/';

const domain = 'localhost:27183';

// initialize vault client with a domain
const client = new VaultClient(domain);

function loginAccount(username, password) {
    return new Promise((resolve, reject) => {
        client.loginAndUnlock(username, password, null, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function resendVerificationEmail(username, password, email, activateLink, loginInfo) {
    return new Promise((resolve, reject) => {
        let options = {
            url          : loginInfo.blob.url,
            id           : loginInfo.blob.id,
            username     : username,        // loginInfo.username
            account_id   : loginInfo.blob.data.account_id,
            email        : email === null ? loginInfo.blob.data.email : email,
            activateLink : activateLink,
            masterkey    : loginInfo.secret
        };
        client.resendEmail(options, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function verifyEmailToken(username, emailToken) {
    return new Promise((resolve, reject) => {
        client.verify(username, emailToken, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function renameAccount(username, newUsername, password, loginInfo) {
    return new Promise((resolve, reject) => {
        let options = {
            username     : username,        // loginInfo.username
            new_username : newUsername,
            password     : password,
            masterkey    : loginInfo.secret,
            blob         : loginInfo.blob
        };
        client.rename(options, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function changePassword(username, newPassword, loginInfo) {
    return new Promise((resolve, reject) => {
        let options = {
            username    : username,         // loginInfo.username
            password    : newPassword,
            masterkey   : loginInfo.secret,
            blob        : loginInfo.blob
        };
        client.changePassword(options, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.loginAccount = loginAccount;
exports.resendVerificationEmail = resendVerificationEmail;
exports.verifyEmailToken = verifyEmailToken;
exports.changePassword = changePassword;
exports.renameAccount = renameAccount;

// export default class ValutClientDemo {
//     constructor() {
//         this._username = '';
//         this._password = '';
//     }
// }