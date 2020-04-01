var admin = require('../lib/authentication.js');

const expiresIn = 60 * 60 * 24 * 5 * 1000;


module.exports.checkIfAuthenticated = async (req, res, next) => {
    var idToken = req.cookies.session || '';

    admin.auth().verifySessionCookie(idToken).then((decodedIdToken) => {
        // Only process if the user just signed in in the last 5 minutes.
        if (new Date().getTime() / 1000 - decodedIdToken.auth_time < 7 * 24 * 3600 * 1000)
            return next();
        else
            res.send('Not authenticated');
    });
  
};

module.exports.logOut = async (req, res) => {
    res.clearCookie('session');
    res.redirect('/login');
};

module.exports.user_object = async (req) =>{
    if(!req.cookies.session){
        return null;
    }
    var idToken = req.cookies.session || '';
    //console.log("User object");
    //console.log(idToken);
    try{
        var decodedToken = await admin.auth().verifySessionCookie(idToken);
        var user = {'email': decodedToken.email, 'uid':decodedToken.user_id,
                    'is_admin': decodedToken.admin}
        //console.log(user);
        return user;
    }
    catch{
        console.log("No user found!");
        return null;
    }

}

module.exports.loginUser =  (email, password) => {
    return new Promise(function(resolve, reject){
        admin.firebase.auth().signInWithEmailAndPassword(email, password).then(({user}) => {
        // Get the user's ID token as it is needed to exchange for a session cookie.
            user.getIdToken().then(idToken => {
                admin.auth().createSessionCookie(idToken, {expiresIn})
                .then((sessionCookie) => {
                    resolve(sessionCookie);
                }, error => {
                    reject("Could not log in user!");
                });
        });
      });
    });
};

module.exports.checkIfAdmin = async (req, res, next) => {
        var idToken = req.cookies.session || '';
        //console.log("User object");
        //console.log(idToken);
        var decodedToken = await admin.auth().verifySessionCookie(idToken);
        if(decodedToken.admin){
            next();
        }
        else{
            res.status(401).send('Only allowed for admins!');
        }    
};


