class RideSharingApp {
  static instance;

  constructor() {
    if (RideSharingApp.instance) return RideSharingApp.instance;

    this.users = [];
    this.drivers = [];
    this.rides = [];
    this.notificator = new Notificator();

    RideSharingApp.instance = this;
  }

  addUser(user) {
    this.users.push(user);
    this.notificator.subscribe(user);
  }

  addDriver(driver) {
    this.drivers.push(driver);
    this.notificator.subscribe(driver);
  }

  async requestRide(user, pickup, dropoff) {
    console.log(`\n🚕 Requesting Ride for ${user.name}...`);
    console.log("=".repeat(40));

    if (this.drivers.length === 0) {
      console.log("❌ No available drivers.");
      return;
    }

    const driversOnDuty = this.drivers.filter((driver) => driver.onDuty);

    if (!driversOnDuty.length) {
      console.log("❌ No on-duty drivers available.");
      return;
    }

    this.notificator.notify(
      [user],
      "🔍 Searching for the best available driver..."
    );

    const driver = await this.simulateDriverSearch(driversOnDuty);

    const cost = (Math.random() * (20 - 5) + 5).toFixed(2);

    const ride = RideFactory.createRide(user, driver, pickup, dropoff, cost);
    this.rides.push(ride);

    console.log(`🚖 Driver was found → : ${driver.name}`);
    console.log(`📍 Pickup: ${pickup}  →  📍 Dropoff: ${dropoff}`);
    console.log(`💰 Estimated Cost: $${cost}`);
    console.log("-".repeat(40));

    this.notificator.notify(
      [user, driver],
      `🚕 New ride created: From ${pickup} to ${dropoff}. Cost: $${cost}`
    );

    if (driver.handleRideRequest(ride)) {
      this.notificator.notify([user], `🚕 Driver is on the way!`);
      ride.status = "driver is on the way";
      this.startRide(ride);
    } else {
      this.notificator.notify([user], `❌ No driver accepted your ride.`);
    }

    return ride;
  }

  simulateDriverSearch(drivers) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(drivers[Math.floor(Math.random() * drivers.length)]);
      }, 3000);
    });
  }

  async startRide(ride) {
    console.log("\n🛫 Ride is starting...");
    console.log("-".repeat(40));

    this.notificator.notify(
      [ride.user, ride.driver],
      `🚗 Ride from ${ride.pickup} to ${ride.dropoff} has started!`
    );

    ride.status = "ongoing";

    await this.simulateRideDuration(ride);
  }

  simulateRideDuration(ride) {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.completeRide(ride);
        resolve();
      }, 3000);
    });
  }

  completeRide(ride) {
    console.log("\n✅ Ride Completed!");
    console.log("=".repeat(40));

    this.notificator.notify(
      [ride.user, ride.driver],
      `✅ Ride from ${ride.pickup} to ${ride.dropoff} is complete!`
    );

    try {
      ride.user.deductBalance(ride.cost);
      ride.driver.addBalance(ride.cost);
      ride.status = "completed";
    } catch (error) {
      this.notificator.notify(
        [ride.user],
        `❌ Payment failed: ${error.message}`
      );
      ride.status("failed");
      console.log("❌ Payment Failed! " + error.message);
    }
  }
}

class User {
  #balance;

  constructor(name, paymentMethod, balance) {
    this.name = name;
    this.paymentMethod = paymentMethod;
    this.#balance = balance;
  }

  update(message) {
    console.log(`[User ${this.name}] 📩 Notification: ${message}`);
  }

  getBalance() {
    return this.#balance;
  }

  deductBalance(amount) {
    if (this.#balance < amount) {
      throw new Error("❌ Insufficient funds. Ride Declined.");
    }
    this.#balance -= amount;
    console.log(`💰 ${this.name} paid $${amount} using ${this.paymentMethod}.`);
  }

  addBalance(amount) {
    this.#balance += amount;
  }
}

class PremiumUser extends User {
  constructor(name, paymentMethod, balance) {
    super(name, paymentMethod, balance);
    this.isPremium = true;
    this.discountRate = 5 / 100; // 5% discount
  }

  deductBalance(amount) {
    const discountedAmount = amount * (1 - this.discountRate);
    if (this.getBalance() < discountedAmount) {
      throw new Error("❌ Insufficient funds. Ride Declined.");
    }
    super.deductBalance(discountedAmount);
    console.log(
      `⭐ Premium User Discount Applied! Saved $${(
        amount * this.discountRate
      ).toFixed(2)}`
    );
  }
}

class Driver {
  #balance;

  constructor(name, onDuty, balance) {
    this.name = name;
    this.onDuty = onDuty;
    this.#balance = balance;
    this.taxiCommission = 5 / 100; // 5% commission
  }

  update(message) {
    console.log(`[Driver ${this.name}] 📩 Notification: ${message}`);
  }

  getBalance() {
    return this.#balance;
  }

  addBalance(amount) {
    const commission = amount * this.taxiCommission;
    this.#balance += amount - commission;
    console.log(
      `💰 ${this.name} received $${(amount - commission).toFixed(
        2
      )}. (${commission.toFixed(2)}$ went to the taxi company as commission.)`
    );
  }

  handleRideRequest(ride) {
    const acceptRide = Math.random() > 0.3;
    if (acceptRide) {
      console.log(
        `✅ ${this.name} accepted the ride: ${ride.pickup} → ${ride.dropoff}.`
      );
      ride.status = "accepted";
      return true;
    } else {
      console.log(
        `❌ ${this.name} declined the ride: ${ride.pickup} → ${ride.dropoff}.`
      );
      ride.status = "declined";
      return false;
    }
  }
}

class VipDriver extends Driver {
  #balance;

  constructor(name, onDuty, balance) {
    super(name, onDuty, balance);
    this.#balance = balance;
    this.taxiCommission = 2.0 / 100; // Reduced commission (2%)
    this.vipPriority = true;
  }

  getBalance() {
    return this.#balance;
  }

  addBalance(amount) {
    const commission = amount * this.taxiCommission;
    this.#balance += amount - commission;
    console.log(
      `⭐ ${this.name} (VIP Driver) received $${(amount - commission).toFixed(
        2
      )}. (${commission.toFixed(2)}$ went to the taxi company as commission.)`
    );
  }
}

class Ride {
  constructor(user, driver, pickup, dropoff, cost) {
    this.user = user;
    this.driver = driver;
    this.pickup = pickup;
    this.dropoff = dropoff;
    this.status = "pending";
    this.cost = cost;
  }
}

class RideFactory {
  static createRide(user, driver, pickup, dropoff, cost) {
    return new Ride(user, driver, pickup, dropoff, cost);
  }
}

class Notificator {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  unsubscribe(observer) {
    this.observers = this.observers.filter((sub) => sub !== observer);
  }

  notify(observers, message) {
    observers.forEach((observer) => observer.update(message));
  }
}

async function testPremiumRide() {
  console.log("\n=== TEST: Premium User Ride (Discount Applied) ===");
  // Create a premium user and a regular driver.
  const premiumUser = new PremiumUser("Bob", "PayPal", 50);
  const driver = new Driver("David", true, 100);

  const rideApp = new RideSharingApp();
  rideApp.addUser(premiumUser);
  rideApp.addDriver(driver);

  // Request a ride.
  const ride = rideApp.requestRide(premiumUser, "University", "Library");
  await new Promise((resolve) => setTimeout(resolve, 3500));

  console.log(`Final Status: ${ride.status}`);
  console.log(
    `Bob's Final Balance (After Discount): $${premiumUser.getBalance()}`
  );
  console.log(`David's Final Balance: $${driver.getBalance()}`);
}

testPremiumRide();
