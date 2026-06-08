const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.sql");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"), null);

        let user = await User.findOne({ where: { email } });

        if (!user) {
          // Create new customer account via Google OAuth
          user = await User.create({
            full_name: profile.displayName,
            email,
            password_hash: "GOOGLE_OAUTH_NO_PASSWORD",
            phone: "0000000000",
            role: "customer",
            is_active: true,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
