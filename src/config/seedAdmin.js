import User from "../models/user.js";

const seedAdmin = async () => {
  const adminExists = await User.findOne({ role: "admin" });

  if (!adminExists) {
    await User.create({
      fullName: "System Admin",
      email: "admin@sandberg.com",
      password: "admin123",
      role: "admin",
    });

    console.log("Default admin created");
  }
};

export default seedAdmin;
