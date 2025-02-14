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

  addUser(role, name, paymentMethod, balance) {
    const user = RoleFactory.createRole(role, name, paymentMethod, balance);
    this.users.push(user);
    this.notificator.subscribe(user);
  }

  addDriver(role, name, onDuty, balance) {
    const driver = RoleFactory.createRole(role, name, onDuty, balance);
    this.drivers.push(driver);
    this.notificator.subscribe(driver);
  }

  async requestRide(user, pickup, dropoff) {
    console.log(`\n🚕 Requesting Ride for ${user.name}...`);
    console.log("=".repeat(40));

    if (
      !pickup ||
      typeof pickup !== "object" ||
      typeof pickup.name !== "string" ||
      typeof pickup.coordinates !== "number"
    ) {
      console.log(
        "❌ Invalid pickup location. Must be an object with a name and numeric coordinates."
      );
      return;
    }

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
      `🔍 Searching for the best available driver near ${pickup.name}...`
    );

    const driver = await this.simulateDriverSearch(
      driversOnDuty,
      pickup.coordinates
    );

    const cost = (Math.random() * (20 - 5) + 5).toFixed(2);

    const ride = new Ride(user, driver, pickup, dropoff, cost);
    this.rides.push(ride);

    console.log(`🚖 Driver was found → : ${driver.name}`);
    console.log(`📍 Pickup: ${pickup.name}`);
    console.log(`📍 Dropoff: ${dropoff}`);
    console.log(`💰 Estimated Cost: $${cost}`);
    console.log("-".repeat(40));

    this.notificator.notify(
      [user, driver],
      `🚕 New ride created: From ${pickup.name} to ${dropoff}. Cost: $${cost}`
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

  simulateDriverSearch(drivers, pickup) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const vipDrivers = drivers.filter(
          (driver) => driver instanceof VipDriver
        );
        const regularDrivers = drivers.filter(
          (driver) => !(driver instanceof VipDriver)
        );

        vipDrivers.sort(
          (a, b) =>
            Math.abs(a.waitingSpot - pickup) - Math.abs(b.waitingSpot - pickup)
        );
        regularDrivers.sort(
          (a, b) =>
            Math.abs(a.waitingSpot - pickup) - Math.abs(b.waitingSpot - pickup)
        );

        const closestDriver =
          vipDrivers.length > 0 ? vipDrivers[0] : regularDrivers[0];

        resolve(closestDriver);
      }, 3000);
    });
  }

  async startRide(ride) {
    console.log("\n🛫 Ride is starting...");
    console.log("-".repeat(40));

    this.notificator.notify(
      [ride.user, ride.driver],
      `🚗 Ride from ${ride.pickup.name} to ${ride.dropoff} has started!`
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
      `✅ Ride from ${ride.pickup.name} to ${ride.dropoff} is complete!`
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
      ride.status = "failed";
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
    this.discountRate = 5 / 100;
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
    this.taxiCommission = 5 / 100;
    this.waitingSpot = Math.floor(Math.random() * 101);
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
        `✅ ${this.name} accepted the ride: ${ride.pickup.name} → ${ride.dropoff}.`
      );
      ride.status = "accepted";
      return true;
    } else {
      console.log(
        `❌ ${this.name} declined the ride: ${ride.pickup.name} → ${ride.dropoff}.`
      );
      ride.status = "declined";
      return false;
    }
  }
}

class VipDriver extends Driver {
  constructor(name, onDuty, balance) {
    super(name, onDuty, balance);
    this.taxiCommission = 2.0 / 100;
    this.vipPriority = true;
  }
}

class RoleFactory {
  static createRole(role, name, paymentMethodOrOnDuty, balance) {
    switch (role.toLowerCase()) {
      case "user":
        return new User(name, paymentMethodOrOnDuty, balance);
      case "premium_user":
        return new PremiumUser(name, paymentMethodOrOnDuty, balance);
      case "driver":
        return new Driver(name, paymentMethodOrOnDuty, balance);
      case "vip_driver":
        return new VipDriver(name, paymentMethodOrOnDuty, balance);
      default:
        throw new Error(`❌ Invalid role: ${role}`);
    }
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

async function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function testClosestDriverSelection() {
  console.log("\n=== TEST: Closest Driver Selection ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Alice", "Credit Card", 50);

  rideApp.addDriver("driver", "Charlie", true, 100); // Random location
  rideApp.addDriver("driver", "David", true, 100); // Random location
  rideApp.addDriver("driver", "Sophia", true, 100); // Random location

  const pickup = { name: "Mall", coordinates: 50 };

  await rideApp.requestRide(rideApp.users[0], pickup, "Park");
  await delay(4);
}

async function testInvalidPickupInput() {
  console.log("\n=== TEST: Invalid Pickup Input ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Bob", "PayPal", 60);

  await rideApp.requestRide(rideApp.users[0], "Mall", "Library"); // ❌ Should fail (string instead of object)
  await rideApp.requestRide(rideApp.users[0], { name: "Mall" }, "Library"); // ❌ Should fail (missing coordinates)
  await rideApp.requestRide(rideApp.users[0], { coordinates: 20 }, "Library"); // ❌ Should fail (missing name)
  await delay(4);
}

async function testAllDriversDeclining() {
  console.log("\n=== TEST: All Drivers Declining ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Charlie", "Debit Card", 80);
  rideApp.addDriver("driver", "Driver 1", true, 100);
  rideApp.addDriver("driver", "Driver 2", true, 100);

  // Force all drivers to decline the ride
  rideApp.drivers.forEach((driver) => (driver.handleRideRequest = () => false));

  const pickup = { name: "Downtown", coordinates: 30 };
  await rideApp.requestRide(rideApp.users[0], pickup, "Airport");
  await delay(4);
}

async function testNoDriversAvailable() {
  console.log("\n=== TEST: No Drivers Available ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Charlie", "Debit Card", 100);

  const pickup = { name: "Museum", coordinates: 10 };
  await rideApp.requestRide(rideApp.users[0], pickup, "Museum"); // ❌ No drivers exist
  await delay(4);
}

async function testNoOnDutyDrivers() {
  console.log("\n=== TEST: No On-Duty Drivers ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Alice", "Credit Card", 50);
  rideApp.addDriver("driver", "Charlie", false, 100);
  rideApp.addDriver("driver", "David", false, 90);

  const pickup = { name: "Cinema", coordinates: 40 };
  await rideApp.requestRide(rideApp.users[0], pickup, "Cinema"); // ❌ No on-duty drivers
  await delay(4);
}

async function testVipDriverPriority() {
  console.log("\n=== TEST: VIP Driver Priority ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("user", "Bob", "PayPal", 75);

  rideApp.addDriver("driver", "Regular Driver", true, 100);
  rideApp.addDriver("vip_driver", "VIP Driver", true, 100); // Should be prioritized
  rideApp.addDriver("driver", "Another Driver", true, 100);

  const pickup = { name: "Stadium", coordinates: 45 };
  await rideApp.requestRide(rideApp.users[0], pickup, "Concert Hall");
  await delay(4);
}

async function testPremiumUserDiscount() {
  console.log("\n=== TEST: Premium User Discount Applied ===");

  const rideApp = new RideSharingApp();
  rideApp.addUser("premium_user", "Alice", "Credit Card", 50); // Premium user with $50 balance
  rideApp.addDriver("driver", "Charlie", true, 100); // Regular driver

  const pickup = { name: "Shopping Mall", coordinates: 35 };

  const ride = await rideApp.requestRide(rideApp.users[0], pickup, "Downtown");

  if (ride) {
    const originalCost = ride.cost / (1 - 0.05); // Reverse the discount (5%)
    console.log(
      `💰 Original Cost before discount: $${originalCost.toFixed(2)}`
    );
    console.log(`💳 Discounted Cost for Premium User: $${ride.cost}`);
    console.log(
      `💵 Alice's Remaining Balance: $${rideApp.users[0].getBalance()}`
    );
  } else {
    console.log("❌ Ride request failed.");
  }

  await delay(4);
}

async function runAllTests() {
  await testClosestDriverSelection();
  await testInvalidPickupInput();
  await testAllDriversDeclining();
  await testNoDriversAvailable();
  await testNoOnDutyDrivers();
  await testVipDriverPriority();
  await testPremiumUserDiscount();
  console.log("\n✅ All tests completed!");
}

runAllTests();
