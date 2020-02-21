var admin = require('../lib/authentication.js');


module.exports.checkIfAuthenticated = async (req, res, next) => {
    try {
        const userInfo = await admin.auth().currentUser;
        if(userInfo) 
            return next();
        else{
            return res
            .status(401)
            .send({ error: 'You are not authorized to make this request' });
        }
    } catch (e) {
      return res
        .status(401)
        .send({ error: 'You are not authorized to make this request' });
    }
};

module.exports.logOut = async () => {
    return admin.auth().signOut();
};

module.exports.user_object = async () =>{
    var user = await admin.auth().currentUser;
    var admin_info = await admin.auth().currentUser.getIdTokenResult()
    user.is_admin = admin_info.claims.admin;
    return user;
}
module.exports.loginUser = async (email, password) => {
    return admin.auth().signInWithEmailAndPassword(email, password);
  };

module.exports.loggedInUser = async () =>{
    if(admin.auth().currentUser){
        console.log("User logged in!");
        var user = admin.auth().currentUser.getIdToken();
        var is_admin = await (admin.auth().currentUser.getIdTokenResult()).claims.admin;
        user.is_admin = is_admin;
        return user;
    }
    else{
        return null;
    }
}
module.exports.checkIfAdmin = async (req, res, next) => {
    try{
        const user_token = await admin.auth().currentUser.getIdTokenResult();
        console.log(user_token.claims.admin);
        if (user_token.claims.admin) {
            return next();
        }
        else{
            return res
            .status(401)
            .send({ error: 'You are not authorized to make this request' });
        }
    }catch (e) {
      return res
        .status(401)
        .send({ error: 'You are not authorized to make this request' });
    }
    
};
