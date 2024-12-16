const Sequelize = require("sequelize");
const { DataTypes } = require("sequelize");
const AWS = require("aws-sdk");

// Initialize SNS
const sns = new AWS.SNS({ region: "us-east-1" });

// Database connection setup
const sequelize = new Sequelize("postgres://postgres:postgres@my-postgresql-instance.cxdomsh2itks.us-east-1.rds.amazonaws.com:5432/cloudproj", {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

// Define the Transaction model
const Transaction = sequelize.define("Transaction", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  details: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  account: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: "transaction", // Table name in PostgreSQL
  timestamps: false, // No createdAt or updatedAt fields
});

// Initialize the database connection
const initializeDatabase = async () => {
  await sequelize.authenticate();
  console.log("Database authenticated successfully!");
};

// Lambda handler
exports.handler = async (event) => {
  try {
    // Initialize the database connection
    await initializeDatabase();

    console.log("Fetching all transactions...");
    // Fetch all transactions from the database
    const transactions = await Transaction.findAll();
    const transactionsData = transactions.map((t) => t.toJSON());
    console.log("Transactions fetched successfully:", transactionsData);

    // Format the email body
    const emailBody = transactionsData
      .map((t) => `ID: ${t.id}, Details: ${t.details}, Amount: ${t.amount}, Account: ${t.account}, Type: ${t.type}, Date: ${t.date}`)
      .join("\n");

    // Fetch the SNS Topic ARN from the environment variable
    const topicArn = process.env.SNS_TOPIC_ARN;
    if (!topicArn) {
      throw new Error("SNS_TOPIC_ARN environment variable is not set");
    }

    // Publish the data to SNS
    const params = {
      Subject: "Daily Transactions Report",
      Message: `Here are the transaction records:\n\n${emailBody}`,
      TopicArn: topicArn,
    };

    console.log("Sending email via SNS...");
    const snsResponse = await sns.publish(params).promise();
    console.log("Email sent successfully:", snsResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully!", snsResponse }),
    };
  } catch (error) {
    console.error("Error occurred:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await sequelize.close();
    console.log("Database connection closed.");
  }
};