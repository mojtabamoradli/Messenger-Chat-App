import { Server } from "socket.io";
import Chat from "../../../models/Chat";
import connectToMongoDB from "../../../functions/connectToMongoDB";
import Group from "../../../models/Group";
import { sign } from "jsonwebtoken";
import User from "../../../models/User";
export default async function handler(req, res) {
  try {
    await connectToMongoDB();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: "failed", message: "Failed to Connect to Database!" });
  }

  // the ability to leave the group i created

  if (res.socket.server.io) {
    console.log("Socket is already running");
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    path: "/api/chat/websocket",
    addTrailingSlash: false,
  });
  res.socket.server.io = io;

  io.on("connection", (socket) => {
    socket.on("join", ({ room }) => socket.join(room));

    socket.on("typing", function ({ status, room, user, userName }) {
      socket.to(room).emit("typingResponse", { status, room, user, userName });
    });

    socket.on("changeMessagesStatusToRead", async function ({ user, room }) {
      try {
        await Chat.updateMany({ $and: [{ room }, { read: false }, { ref: { $ne: user } }] }, { $set: { read: true } }); //  unreadRoomMessages
        const chatHistory = await Chat.find({ room }).lean();
        const users = await User.find({}).lean();
        const chatsPlusName = chatHistory.map((item) => {
          const relatedData = users.find((el) => el._id == item.ref);
          return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
        });
        io.to(room).emit("messages", chatsPlusName);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("onlineUsers", async function ({ user, room }) {
      io.emit("onlineUsersResponse", { user, room });
    });

    socket.on("editMessage", async function ({ messageId, room, editedMessage }) {
      await Chat.findOneAndUpdate({ _id: messageId }, { message: editedMessage });
      const chatHistory = await Chat.find({ room: room }).lean();
      const users = await User.find({}).lean();
      const chatsPlusName = chatHistory.map((item) => {
        const relatedData = users.find((el) => el._id == item.ref);
        return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
      });

      io.to(room).emit("messages", chatsPlusName);
    });

    socket.on("deleteMessage", async function ({ _id, room }) {
      await Chat.findOneAndDelete({ _id: _id });
      const chatHistory = await Chat.find({ room: room }).lean();
      const users = await User.find({}).lean();
      const chatsPlusName = chatHistory.map((item) => {
        const relatedData = users.find((el) => el._id == item.ref);
        return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
      });
      io.to(room).emit("messages", chatsPlusName);
    });

    socket.on("deleteAllChatMessages", async function ({ room }) {
      await Chat.deleteMany({ room: room });
      const chatHistory = await Chat.find({ room: room }).lean();
      const users = await User.find({}).lean();
      const chatsPlusName = chatHistory.map((item) => {
        const relatedData = users.find((el) => el._id == item.ref);
        return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
      });
      io.to(room).emit("messages", chatsPlusName);
    });

    socket.on("createGroup", async function ({ name, members, masters }) {
      await Group.create({ masters, members, name, room: [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join(""), createdAt: new Date() });
      io.emit("updateGroup");
    });

    socket.on("deleteGroup", async function ({ groupId, groupRoom }) {
      await Group.findOneAndDelete({ _id: groupId });
      await Chat.deleteMany({ room: groupRoom });
      io.emit("updateGroup");
    });

    socket.on("addMembersToGroup", async function ({ groupId, room, newMembers }) {
      const updatedGroup = await Group.findOneAndUpdate({ _id: groupId }, { $addToSet: { members: { $each: newMembers } } }, { new: true, lean: true });

      const usersInfo = await User.find({}).lean();

      function getUserInfoByIds(userIds, usersInfo) {
        const result = userIds.map((userId) => {
          const userInfo = usersInfo.find((user) => user._id == userId);
          if (userInfo) {
            const { _id, firstName, lastName } = userInfo;
            return { _id, firstName, lastName };
          } else {
            return null;
          }
        });

        return result;
      }

      function getGroupInfo(group, usersInfo) {
        const { members, masters, ...otherProps } = group;
        const groupMembersInfo = getUserInfoByIds(members, usersInfo);
        const groupMastersInfo = getUserInfoByIds(masters, usersInfo);
        return { ...otherProps, members: groupMembersInfo, masters: groupMastersInfo };
      }

      const group = getGroupInfo(updatedGroup, usersInfo);

      io.emit("updateGroup");
      io.to(room).emit("groupHistoryResponse", group);
    });

    socket.on("removeMemberFromGroup", async function ({ groupId, room, memberToRemove }) {
      const updatedGroup = await Group.findOneAndUpdate({ _id: groupId }, { $pull: { members: memberToRemove, masters: memberToRemove } }, { new: true, lean: true });
      const usersInfo = await User.find({}).lean();

      function getUserInfoByIds(userIds, usersInfo) {
        const result = userIds.map((userId) => {
          const userInfo = usersInfo.find((user) => user._id == userId);
          if (userInfo) {
            const { _id, firstName, lastName } = userInfo;
            return { _id, firstName, lastName };
          } else {
            return null;
          }
        });

        return result;
      }

      function getGroupInfo(group, usersInfo) {
        const { members, masters, ...otherProps } = group;
        const groupMembersInfo = getUserInfoByIds(members, usersInfo);
        const groupMastersInfo = getUserInfoByIds(masters, usersInfo);
        return { ...otherProps, members: groupMembersInfo, masters: groupMastersInfo };
      }

      const group = getGroupInfo(updatedGroup, usersInfo);
      io.emit("updateGroup");
      io.to(room).emit("groupHistoryResponse", group);
    });

    socket.on("makeMaster", async function ({ groupId, room, newMasterToAdd }) {
      const updatedGroup = await Group.findOneAndUpdate({ _id: groupId }, { $addToSet: { masters: newMasterToAdd } }, { new: true, lean: true });

      const usersInfo = await User.find({}).lean();

      function getUserInfoByIds(userIds, usersInfo) {
        const result = userIds.map((userId) => {
          const userInfo = usersInfo.find((user) => user._id == userId);
          if (userInfo) {
            const { _id, firstName, lastName } = userInfo;
            return { _id, firstName, lastName };
          } else {
            return null;
          }
        });

        return result;
      }

      function getGroupInfo(group, usersInfo) {
        const { members, masters, ...otherProps } = group;
        const groupMembersInfo = getUserInfoByIds(members, usersInfo);
        const groupMastersInfo = getUserInfoByIds(masters, usersInfo);
        return { ...otherProps, members: groupMembersInfo, masters: groupMastersInfo };
      }

      const group = getGroupInfo(updatedGroup, usersInfo);
      io.emit("updateGroup");
      io.to(room).emit("groupHistoryResponse", group);
    });

    socket.on("unmakeMaster", async function ({ groupId, room, masterToUnmake }) {
      const updatedGroup = await Group.findOneAndUpdate({ _id: groupId }, { $pull: { masters: masterToUnmake } }, { new: true, lean: true });

      const usersInfo = await User.find({}).lean();

      function getUserInfoByIds(userIds, usersInfo) {
        const result = userIds.map((userId) => {
          const userInfo = usersInfo.find((user) => user._id == userId);
          if (userInfo) {
            const { _id, firstName, lastName } = userInfo;
            return { _id, firstName, lastName };
          } else {
            return null;
          }
        });

        return result;
      }

      function getGroupInfo(group, usersInfo) {
        const { members, masters, ...otherProps } = group;
        const groupMembersInfo = getUserInfoByIds(members, usersInfo);
        const groupMastersInfo = getUserInfoByIds(masters, usersInfo);
        return { ...otherProps, members: groupMembersInfo, masters: groupMastersInfo };
      }

      const group = getGroupInfo(updatedGroup, usersInfo);
      io.emit("updateGroup");
      io.to(room).emit("groupHistoryResponse", group);
    });

    socket.on("newMessage", async function ({ ref, pictures, voice, attachment, room, message }) {
      await Chat.create({ ref: ref, pictures, attachment, room, voice, message, createdAt: new Date() });
      const chatHistory = await Chat.find({ room }).lean();
      const users = await User.find({}).lean();
      const chatsPlusName = chatHistory.map((item) => {
        const relatedData = users.find((el) => el._id == item.ref);
        return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
      });
      io.to(room).emit("messages", chatsPlusName);
    });

    socket.on("initiate", async function ({ room }) {
      const chatHistory = await Chat.find({ room }).lean();
      const users = await User.find({}).lean();
      const chatsPlusName = chatHistory.map((item) => {
        const relatedData = users.find((el) => el._id == item.ref);
        return { ...item, refFirstName: relatedData?.firstName, refLastName: relatedData?.lastName };
      });

      io.to(room).emit("messages", chatsPlusName);
    });

    socket.on("users", async function () {
      const users = await User.find({}, { _id: 1, firstName: 1, lastName: 1 });

      io.emit("usersResponse", users);
    });

    socket.on("clients", async function () {
      const guestsMessages = await Chat.find({ ref: "Client" }).lean();

      function getRooms(guestsMessages) {
        const rooms = new Set();

        guestsMessages.forEach((obj) => {
          if (obj.room) {
            rooms.add(obj.room);
          }
        });

        return Array.from(rooms);
      }

      const rooms = getRooms(guestsMessages);

      const transformedArray = rooms.map((string) => {
        const parts = string.split("-");
        const room = string;
        const allegedFullName = parts[1];
        const allegedCredential = parts[2];
        const roomChats = guestsMessages.filter((chat) => chat.room === room);
        const roomUnreadChats = roomChats.filter((chat) => chat.read == false);

        const latestChat = roomChats.sort((a, b) => b.createdAt - a.createdAt)[0];

        return { room, allegedFullName, allegedCredential, roomUnreadChats: roomUnreadChats?.length, latestChat };
      });

      io.emit("clientsResponse", transformedArray);
    });

    socket.on("groups", async function () {
      const allGroups = await Group.find({}).lean();
      const usersInfo = await User.find({}).lean();

      function getUserInfoByIds(userIds, usersInfo) {
        const result = userIds.map((userId) => {
          const userInfo = usersInfo.find((user) => user._id == userId);
          if (userInfo) {
            const { _id, firstName, lastName } = userInfo;
            return { _id, firstName, lastName };
          } else {
            return null;
          }
        });

        return result;
      }

      function getUsersInfoByGroup(allGroups, usersInfo) {
        const result = allGroups.map((group) => {
          const { members, masters, ...otherProps } = group;
          const groupMembersInfo = getUserInfoByIds(members, usersInfo);
          const groupMastersInfo = getUserInfoByIds(masters, usersInfo);
          return { ...otherProps, members: groupMembersInfo, masters: groupMastersInfo };
        });

        return result;
      }

      const groups = getUsersInfoByGroup(allGroups, usersInfo);

      for (const group of groups) {
        const latestChat = await Chat.findOne({ room: group.room }).sort({ createdAt: -1 });

        group.latestChat = latestChat;
      }

      const userMapping = {};
      for (const user of usersInfo) {
        userMapping[user._id] = user;
      }

      for (const group of groups) {
        const latestChat = group.latestChat;
      
        if (latestChat && latestChat.ref) {
          const refUser = userMapping[latestChat.ref];
      
          if (refUser) {
            const updatedLatestChat = {
              ...latestChat.toObject(), 
              refFirstName: refUser.firstName,
              refLastName: refUser.lastName
            };
      
            group.latestChat = updatedLatestChat;
          }
        }
      }

      io.emit("groupsResponse", groups);
    });

    socket.on("unreadCounts", async function () {
      const users = await User.find({}, { _id: 1, firstName: 1, lastName: 1 }).lean();
      const chats = await Chat.find({}).lean();

      const userIds = users.map((user) => user._id);

      const rooms = [];
      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          const sortedIds = [userIds[i], userIds[j]].sort();
          rooms.push(sortedIds.join("-"));
        }
      }

      const result = [];

      rooms.forEach((room) => {
        const roomChats = chats.filter((chat) => chat.room === room && chat.read == false);

        let latestChat = null;

        for (const chat of chats) {
          if (chat.room === room) {
            if (!latestChat || chat.createdAt > latestChat.createdAt) {
              latestChat = { ref: chat.ref, message: chat.message, createdAt: chat.createdAt, refFirstName: users.filter((user) => user._id == chat.ref)[0]?.firstName, refLastName: users.filter((user) => user._id == chat.ref)[0]?.lastName };
            }
          }
        }
        roomChats.forEach((chat) => {
          const existingChat = result.find((entry) => entry.room === room && entry.ref === chat.ref);
          if (existingChat) {
            existingChat.unreadMessagesCount++;
          } else {
            result.push({ room, ref: chat.ref, unreadMessagesCount: 1, latestChat });
          }
        });
      });

      io.emit("unreadCountsResponse", result);
    });

    // function encode(payload) {
    //   const encodedRoom = sign(payload, process.env.JWT_SECRET_KEY);
    //   return encodedRoom;
    // }

    // encode({secretKey: process.env.ADMIN_SECRET_IN_APP_PRIVATE_KEY, timestamp: Date.now(), allegedFullName: "mojtaba", allegedCredential: "mojtaba@yahoo.com"})
  });
  res.end();
}
