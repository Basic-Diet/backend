require('dotenv').config();
const mongoose = require('mongoose');
const { buildSubscriptionTimeline } = require('./src/services/subscription/subscriptionTimelineService');
const Subscription = require('./src/models/Subscription');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/basicdiet145');
  const sub = await Subscription.findOne({ status: 'active' }).sort({ createdAt: -1 }).lean();
  if (!sub) {
    console.log("No active subscription found.");
    process.exit(0);
  }
  const timeline = await buildSubscriptionTimeline(sub._id);
  const contradictoryDays = timeline.days.filter(d => d.status === 'open' && d.canEdit === false);
  const targetDays = timeline.days.filter(d => d.lockedReason || d.canEdit === false);
  
  console.log("Subscription ID:", sub._id);
  if (contradictoryDays.length > 0) {
    console.log("Found contradictory days (open but cannot edit):");
    console.log(JSON.stringify(contradictoryDays[0], null, 2));
  } else if (targetDays.length > 0) {
    console.log("No contradictory days! Here is a day with canEdit=false:");
    console.log(JSON.stringify(targetDays[0], null, 2));
  }
  process.exit(0);
}
run().catch(console.error);
