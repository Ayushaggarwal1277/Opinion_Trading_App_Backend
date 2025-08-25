import mongoose from "mongoose";


const tradeSchema = new mongoose.Schema({
    market:{
        type: mongoose.Types.ObjectId,
        ref : "Market",
    },

    user:{
        type: mongoose.Types.ObjectId,
        ref : "User",
    },
    option:{
        type : String,
        enum : ["yes", "no"],
        required : true,
    },
    side:{
        type : String,
        enum : ["buy", "sell"],
        default : "buy",
    },
    amount:{
        type : Number,
        required : true,
    },
    price:{
        type : Number,
        required : true,
        min: 0.5,
        max: 9.5,
    },
    executePrice:{
        type : Number,
    },
    executedAmount:{
        type : Number,
    },
    status:{
        type : String,
        enum : ["EXECUTED", "PENDING", "CANCELLED", "SETTLED"],
        default : "PENDING",
    }

},
{
    timestamps : true,
})


export const Trade = mongoose.model("Trade", tradeSchema);