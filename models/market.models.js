import mongoose from "mongoose";


const marketSchema = new mongoose.Schema({
    question :{
        type : String,
        required : true,
        unique : true,
    },

    
    yesPrice:{
            type : Number,
            default : 5,
    },

    
    noPrice:{
            type : Number,
            default : 5,
    },
    

    expiry :{
        type : Date,
        required : true,
    },

    status:{
        type : String,
        enum : ["active", "expired"],
        default : "active",
    },

    result:{
        type : String,
        enum : ["YES", "NO"],
    },

    totalYesAmount:{
        type : Number,
        default : 0,
    },

    totalNoAmount:{
        type : Number,
        default : 0,
    },

    threshold:{
        type : Number,
        required : true
    },


},
{
    timestamps : true,
})


export const Market =  mongoose.model("Market", marketSchema);