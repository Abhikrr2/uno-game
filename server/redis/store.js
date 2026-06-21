const { createClient } = require('redis');

class Store {
  constructor() {
    this.redisClient = null;
    this.isRedisConnected = false;

    // In-memory fallbacks
    this.rooms = new Map(); // roomCode -> roomState
    this.users = new Map(); // socketId -> { id (UUID), name }
    this.userSockets = new Map(); // userId (UUID) -> socketId
  }

  async connect() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.log('REDIS_URL not provided. Running in high-performance In-Memory Mode.');
      return;
    }

    try {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => {
        console.error('Redis client error, falling back to In-Memory:', err.message);
        this.isRedisConnected = false;
      });

      await this.redisClient.connect();
      console.log('Successfully connected to Redis.');
      this.isRedisConnected = true;
    } catch (err) {
      console.error('Failed to connect to Redis, using in-memory store:', err.message);
      this.isRedisConnected = false;
      this.redisClient = null;
    }
  }

  // --- Room CRUD ---

  async getRoom(roomCode) {
    const code = roomCode.toUpperCase();
    if (this.isRedisConnected) {
      try {
        const data = await this.redisClient.get(`room:${code}`);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Redis getRoom error:', err);
      }
    }
    return this.rooms.get(code) || null;
  }

  async setRoom(roomCode, state) {
    const code = roomCode.toUpperCase();
    if (this.isRedisConnected) {
      try {
        // Set expiry of 2 hours for rooms to prevent cluttering
        await this.redisClient.setEx(`room:${code}`, 7200, JSON.stringify(state));
        return;
      } catch (err) {
        console.error('Redis setRoom error:', err);
      }
    }
    this.rooms.set(code, state);
  }

  async deleteRoom(roomCode) {
    const code = roomCode.toUpperCase();
    if (this.isRedisConnected) {
      try {
        await this.redisClient.del(`room:${code}`);
        return;
      } catch (err) {
        console.error('Redis deleteRoom error:', err);
      }
    }
    this.rooms.delete(code);
  }

  // --- User / Socket Mapping ---

  async addUser(socketId, userData) {
    if (this.isRedisConnected) {
      try {
        await this.redisClient.setEx(`user:${socketId}`, 7200, JSON.stringify(userData));
        await this.redisClient.setEx(`user_socket:${userData.id}`, 7200, socketId);
        return;
      } catch (err) {
        console.error('Redis addUser error:', err);
      }
    }
    this.users.set(socketId, userData);
    this.userSockets.set(userData.id, socketId);
  }

  async getUser(socketId) {
    if (this.isRedisConnected) {
      try {
        const data = await this.redisClient.get(`user:${socketId}`);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Redis getUser error:', err);
      }
    }
    return this.users.get(socketId) || null;
  }

  async removeUser(socketId) {
    const user = await this.getUser(socketId);
    if (user) {
      if (this.isRedisConnected) {
        try {
          await this.redisClient.del(`user:${socketId}`);
          await this.redisClient.del(`user_socket:${user.id}`);
          return;
        } catch (err) {
          console.error('Redis removeUser error:', err);
        }
      }
      this.userSockets.delete(user.id);
    }
    this.users.delete(socketId);
  }

  async mapUserIdToSocket(userId, socketId) {
    if (this.isRedisConnected) {
      try {
        await this.redisClient.setEx(`user_socket:${userId}`, 7200, socketId);
        const userStr = await this.redisClient.get(`user:${socketId}`);
        if (userStr) {
          const user = JSON.parse(userStr);
          await this.redisClient.setEx(`user:${socketId}`, 7200, JSON.stringify({ ...user, id: userId }));
        }
        return;
      } catch (err) {
        console.error('Redis mapUserIdToSocket error:', err);
      }
    }
    this.userSockets.set(userId, socketId);
  }

  async getSocketByUserId(userId) {
    if (this.isRedisConnected) {
      try {
        return await this.redisClient.get(`user_socket:${userId}`);
      } catch (err) {
        console.error('Redis getSocketByUserId error:', err);
      }
    }
    return this.userSockets.get(userId) || null;
  }
}

module.exports = new Store();
