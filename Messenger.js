import axios from "axios";
import Image from "next/image";
import React, { createRef, useRef, useState } from "react";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import Cropper from "react-cropper";
import io from "socket.io-client";
import "cropperjs/dist/cropper.css";
import Link from "next/link";
import { gql, useQuery } from "@apollo/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/router";

import ChatCropperModal from "../../utils/ChatCropperModal";

let socket;

const Messenger = () => {
  const isLoggedIn = useSelector((state) => state.authReducer.user);

  const router = useRouter();

  const [allegedFullName, setAllegedFullName] = useState();
  const [allegedCredential, setAllegedCredential] = useState();
  const [initiateChatWithSupport, setInitiateChatWithSupport] = useState(false);

  const [contacts, setContacts] = useState(isLoggedIn ? true : false);

  const [room, setRoom] = useState();
  const [chatRoomData, setChatRoomData] = useState({ _id: null, avatar: null, firstName: null, lastName: null });
  const [group, setGroup] = useState({ _id: null, name: null, room: null, members: null, masters: null, createdAt: null });

  const [openGroupMenu, setOpenGroupMenu] = useState(false);

  const [messageInput, setMessageInput] = useState();
  const [messages, setMessages] = useState([]);
  const [userGroups, setUserGroups] = useState([]);

  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);

  const [usersTab, setUsersTab] = useState(true);
  const [clientsTab, setClientsTab] = useState(false);
  const [groupsTab, setGroupsTab] = useState(false);

  const openUsersTab = () => {
    setUsersTab(true);
    setClientsTab(false);
    setGroupsTab(false);
    setLetsCreateNewGroup(false);
  };

  const openClientsTab = () => {
    setUsersTab(false);
    setClientsTab(true);
    setGroupsTab(false);
    setLetsCreateNewGroup(false);
  };

  const openGroupsTab = () => {
    setUsersTab(false);
    setClientsTab(false);
    setGroupsTab(true);
  };

  const [typingStatus, setTypingStatus] = useState({ status: "", room, user: isLoggedIn?._id, userName: `${isLoggedIn?.firstName} ${isLoggedIn?.lastName}...` });
  const [onlineUsers, setOnlineUsers] = useState({ user: isLoggedIn?._id, room });
  const [sending, setSending] = useState(false);

  const [editedMessage, setEditedMessage] = useState();
  const [editMessage, setEditMessage] = useState({ status: false, _id: null });
  const [deleteMessage, setDeleteMessage] = useState({ status: false, _id: null });

  const [file, setFile] = useState();

  const [fileToUpload, setFileToUpload] = useState();

  // ↓ Notification ↓

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    notifications.forEach((notification, index) => {
      setTimeout(
        () => {
          setNotifications((prevNotifications) => prevNotifications.filter((_, i) => i !== index));
        },
        (index + 1) * 5000
      );
    });
  }, [notifications]);

  // ↑ Notification ↑

  // ↓ Edit/Delete Message ↓

  const editMessageById = (_id) => {
    socket.emit("editMessage", { messageId: _id, editedMessage, room });
    setEditMessage({ status: false, _id: null });
  };

  const deleteMessageById = (_id) => {
    socket.emit("deleteMessage", { _id, room });
    setDeleteMessage({ status: false, _id: null });
  };

  // ↑ Edit/Delete Message ↑

  // ↓ Delete Group, Add/Remove Member ↓

  const removeMembersFromGroup = ({ memberToRemove }) => socket.emit("removeMemberFromGroup", { groupId: group._id, room, memberToRemove });
  const leaveGroup = () => {
    socket.emit("removeMemberFromGroup", { groupId: group._id, room, memberToRemove: isLoggedIn._id });
    setContacts(true);
    setOpenGroupMenu(false);
  };

  const [addMember, setAddMember] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState([]);

  const groupMembersToAddHandler = (itemId) => {
    setMembersToAdd((prevMembers) => {
      if (prevMembers.includes(itemId)) {
        return prevMembers.filter((id) => id !== itemId);
      } else {
        return [...prevMembers, itemId];
      }
    });
  };

  const addSelectedMembersToGroup = () => {
    socket.emit("addMembersToGroup", { groupId: group._id, room, newMembers: membersToAdd });
    setAddMember(false);
    setMembersToAdd([]);
  };

  const deleteGroup = () => {
    socket.emit("deleteGroup", { groupId: group._id, groupRoom: group.room });
    setContacts(true);
    setOpenGroupMenu(false);
  };

  const makeMaster = (_id) => socket.emit("makeMaster", { groupId: group._id, room, newMasterToAdd: _id });
  const unmakeMaster = (_id) => socket.emit("unmakeMaster", { groupId: group._id, room, masterToUnmake: _id });

  socket?.on("groupHistoryResponse", (data) => setGroup(data));

  const deleteAllChatMessages = () => {
    socket.emit("deleteAllChatMessages", { room });
    setOpenGroupMenu(false);
  };

  // ↑ Delete Group, Add/Remove Member, Make Admin, Unmake admin, Delete All Chats ↑

  // ↓ Create New Group ↓

  const [letsCreateNewGroup, setLetsCreateNewGroup] = useState(false);
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState();

  const addToNewGroupMembersList = (_id) => {
    setNewGroupMembers((prevMembers) => {
      if (prevMembers.includes(_id)) {
        return prevMembers.filter((memberId) => memberId !== _id);
      } else {
        return [...prevMembers, _id];
      }
    });
  };

  const createNewGroup = () => {
    socket?.emit("createGroup", { name: newGroupName, members: [...new Set([...newGroupMembers, isLoggedIn._id])], masters: [isLoggedIn._id] });
    setLetsCreateNewGroup(false);
    setNewGroupMembers([]);
    setNewGroupName();
  };

  // ↑ Create New Group ↑

  // ↓ Start Chat Functions ↓

  const letsChatWithMyself = async () => {
    setRoom(`${isLoggedIn._id}-${isLoggedIn._id}`);
    setChatRoomData({ chatTitle: "Saved Messages", _id: null, avatar: null, firstName: null, lastName: null, allegedFullName: null, allegedCredential: null });
    setGroup({ _id: null, name: null, members: null, masters: null, createdAt: null, avatar: null });
    setContacts(false);
  };

  const letsPrivateChat = ({ _id, avatar, firstName, lastName }) => {
    setRoom(`${[_id, isLoggedIn?._id].sort().join("-")}`);
    setChatRoomData({ _id, chatTitle: `${firstName} ${lastName}`, avatar, firstName, lastName, allegedFullName: null, allegedCredential: null });
    setGroup({ _id: null, name: null, members: null, masters: null, createdAt: null, avatar: null });
    setContacts(false);
  };

  const letsChatWithAdminAsClient = () => {
    setRoom(`${Date.now()}-${allegedFullName}-${allegedCredential}`);
    setChatRoomData({ _id: null, chatTitle: "Mojtaba Moradli", avatar: "https://mojtabamoradli.storage.iran.liara.space/Avatars/admin.jpg", firstName: null, lastName: null, allegedFullName: null, allegedCredential: null });
    setGroup({ _id: null, name: null, members: null, masters: null, createdAt: null, avatar: null });
    setInitiateChatWithSupport(true);
  };

  const letsGroupChat = ({ _id, name, room, members, masters, createdAt, avatar }) => {
    setRoom(room);
    setChatRoomData({ _id: null, chatTitle: name, avatar: null, firstName: null, lastName: null, allegedFullName: null, allegedCredential: null });
    setGroup({ _id, name, members, masters, createdAt, avatar });
    setContacts(false);
  };

  const letsChatWithClientsAsAdmin = ({ allegedFullName, allegedCredential, room }) => {
    setRoom(room);
    setGroup({ _id: null, name: null, members: null, masters: null, createdAt: null, avatar: null });
    setChatRoomData({ _id: null, chatTitle: allegedFullName, avatar: null, firstName: null, lastName: null, allegedFullName, allegedCredential });
    setContacts(false);
  };

  // ↑ Start Chat Functions ↑

  // ↓ Cropper Related ↓

  const cropperRef = createRef();

  const [openChatCropperModal, setOpenChatCropperModal] = useState({ status: false, index: null });

  const getCropData = async () => {
    const dataUrl = cropperRef.current?.cropper.getCroppedCanvas().toDataURL();
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setFileToUpload(new File([blob], "fileName", { type: dataUrl.split(",")[0].split(":")[1].split(";")[0] }));
    setOpenChatCropperModal({ status: false, index: null });
  };

  // ↑ Cropper Related ↑

  // ↓ Voice Related ↓

  let timer;

  const [recording, setRecording] = useState(false);
  const [voiceURL, setVoiceURL] = useState("");
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const voiceRecorderRef = useRef(null);
  const voiceRef = useRef(null);

  const handleRecordedVoice = (event) => {
    if (event.data.size > 0) {
      const recordedAudioURL = URL.createObjectURL(event.data);
      setVoiceURL(recordedAudioURL);

      const blob = event.data;
      const fileReader = new FileReader();

      fileReader.onloadend = () => {
        const file = new File([fileReader.result], "audio.wav", { type: "audio/wav" });
        setFileToUpload(file);
      };

      fileReader.readAsArrayBuffer(blob);
    }
  };

  const startRecording = () => {
    try {
      if (voiceRecorderRef?.current) {
        voiceRecorderRef?.current?.start();
        setRecording(true);
        let seconds = 0;
        timer = setInterval(() => {
          seconds++;
          if (seconds >= 60) {
            stopRecording();
          }
        }, 1000);
      }
    } catch (error) {
      setNotifications((prevNotifications) => [...prevNotifications, { status: true, message: "Microphone Blocked!" }]);
    }
  };

  const stopRecording = () => {
    voiceRecorderRef?.current?.stop();
    setRecording(false);
    clearInterval(timer);
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        voiceRecorderRef.current = new MediaRecorder(stream);

        voiceRecorderRef.current?.addEventListener("dataavailable", handleRecordedVoice);
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        setNotifications((prevNotifications) => [...prevNotifications, { status: true, message: "Error accessing microphone!" }]);
      });
  }, []);

  useEffect(() => {
    const handleTimeUpdate = () => {
      setVoiceCurrentTime(voiceRef.current.currentTime);
      setVoiceDuration(voiceRef.current.duration);
    };

    voiceRef.current && voiceRef.current.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      voiceRef.current && voiceRef.current.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [voiceRef.current]);

  const VoiceMessagePlayer = ({ voice }) => {
    const voiceRefs = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
    const [voiceDuration, setVoiceDuration] = useState(0);

    useEffect(() => {
      const handleTimeUpdate = () => {
        setVoiceCurrentTime(voiceRefs?.current?.currentTime);
        setVoiceDuration(voiceRefs?.current?.duration);
      };

      voiceRefs.current && voiceRefs?.current?.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        voiceRefs.current && voiceRefs?.current?.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }, [voiceRefs.current]);

    useEffect(() => {
      const handleEnded = () => {
        setIsPlaying(false);
      };

      voiceRefs.current && voiceRefs?.current?.addEventListener("ended", handleEnded);

      return () => {
        voiceRefs.current && voiceRefs?.current?.removeEventListener("ended", handleEnded);
      };
    }, []);

    const playSentVoice = () => {
      voiceRefs.current.currentTime = 0;
      voiceRefs.current.play();
      setIsPlaying(true);
    };

    const pauseSentVoice = () => {
      voiceRefs.current.pause();
      setIsPlaying(false);
    };

    return (
      <div className="flex w-[165px] h-[35px] border-[1.5px] border-solid border-gray-900 bg-blue-50 mb-2 rounded-lg">
        <div className="flex relative h-[32px] w-[55px] left-[6px] top-[1px] items-center ">{voiceDuration && voiceCurrentTime ? `${!isPlaying ? voiceDuration.toFixed(1) : -(voiceDuration - voiceCurrentTime).toFixed(1)}″` : ""}</div>
        <svg id="sent-voice-animation" className="mt-[3px] w-[100px] mr-[10px] ml-[-20px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path d="M 0 25 Q 12.5 15, 25 25 Q 37.5 35, 50 25 Q 62.5 15, 75 25 Q 87.5 35, 100 25" fill="none" stroke="black" strokeWidth="2" style={{ transform: `scaleX(${(voiceCurrentTime / voiceDuration) * 2})` }} />
        </svg>
        <audio hidden ref={voiceRefs} src={voice} />

        <div className="flex items-center   bottom-[25px]  w-fit h-[32px] mr-[5px]">
          {!isPlaying ? (
            <button id="play" className="hover:opacity-70 transition-all duration-300" onClick={playSentVoice}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path d="M7.87 21.28C7.08 21.28 6.33 21.09 5.67 20.71C4.11 19.81 3.25 17.98 3.25 15.57V8.43999C3.25 6.01999 4.11 4.19999 5.67 3.29999C7.23 2.39999 9.24 2.56999 11.34 3.77999L17.51 7.33999C19.6 8.54999 20.76 10.21 20.76 12.01C20.76 13.81 19.61 15.47 17.51 16.68L11.34 20.24C10.13 20.93 8.95 21.28 7.87 21.28ZM7.87 4.21999C7.33 4.21999 6.85 4.33999 6.42 4.58999C5.34 5.20999 4.75 6.57999 4.75 8.43999V15.56C4.75 17.42 5.34 18.78 6.42 19.41C7.5 20.04 8.98 19.86 10.59 18.93L16.76 15.37C18.37 14.44 19.26 13.25 19.26 12C19.26 10.75 18.37 9.55999 16.76 8.62999L10.59 5.06999C9.61 4.50999 8.69 4.21999 7.87 4.21999Z" fill="#292D32" />{" "}
              </svg>
            </button>
          ) : (
            <button className="hover:opacity-70 transition-all duration-300" onClick={pauseSentVoice}>
              <svg id="pause" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path d="M8.64 21.75H5.01C3.15 21.75 2.25 20.89 2.25 19.11V4.89C2.25 3.11 3.15 2.25 5.01 2.25H8.64C10.5 2.25 11.4 3.11 11.4 4.89V19.11C11.4 20.89 10.5 21.75 8.64 21.75ZM5.01 3.75C3.93 3.75 3.75 4.02 3.75 4.89V19.11C3.75 19.98 3.92 20.25 5.01 20.25H8.64C9.72 20.25 9.9 19.98 9.9 19.11V4.89C9.9 4.02 9.73 3.75 8.64 3.75H5.01Z" fill="#292D32" />
                <path d="M18.9901 21.75H15.3601C13.5001 21.75 12.6001 20.89 12.6001 19.11V4.89C12.6001 3.11 13.5001 2.25 15.3601 2.25H18.9901C20.8501 2.25 21.7501 3.11 21.7501 4.89V19.11C21.7501 20.89 20.8501 21.75 18.9901 21.75ZM15.3601 3.75C14.2801 3.75 14.1001 4.02 14.1001 4.89V19.11C14.1001 19.98 14.2701 20.25 15.3601 20.25H18.9901C20.0701 20.25 20.2501 19.98 20.2501 19.11V4.89C20.2501 4.02 20.0801 3.75 18.9901 3.75H15.3601Z" fill="#292D32" />{" "}
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ↑ Voice Related ↑

  // ↓ Emitting and On-ing ↓
  const reconnect = () => {
    socket?.emit("clients");
    socket?.emit("users");
    socket?.emit("groups");
    socket?.emit("unreadCounts", { _id: isLoggedIn?._id });
  };
  const [unreadCounts, setUnreadCounts] = useState();

  socket?.on("unreadCountsResponse", (data) => setUnreadCounts(data));

  useEffect(() => {
    fetch("/api/chat/websocket");
    socket = io(undefined, {
      path: "/api/chat/websocket",
    });

    socket?.emit("join", { room });

    socket?.emit("initiate", { room });

    socket?.on("typingResponse", ({ status, room, user, userName }) => setTypingStatus({ status, room, user, userName }));

    socket?.on("messages", (data) => setMessages(data));

    socket?.emit("onlineUsers", { user: isLoggedIn?._id, room });

    return () => {
      socket.disconnect();
    };
  }, [room]);

  socket?.on("onlineUsersResponse", ({ user, room }) => setOnlineUsers({ user, room }));

  useEffect(() => {
    reconnect();
  }, [socket]);

  useEffect(() => {
    room && socket?.emit("changeMessagesStatusToRead", { user: isLoggedIn?._id, room });
  }, [room]);

  socket?.on("groupsResponse", (data) => setUserGroups(data?.filter((group) => group?.members?.some((member) => member._id == isLoggedIn?._id))));

  socket?.on("usersResponse", (data) => setUsers(data));
  socket?.on("clientsResponse", (data) => setClients(data));

  socket?.once("updateGroup", () => {
    socket?.emit("groups");
  });

  const IS_LOGGED_IN_VISAS_QUERY = gql`
    query ($_id: ID!) {
      UserVisas(_id: $_id) {
        _id
        iat
        eat
        n
      }
    }
  `;

  const { loading, data: { UserVisas } = {}, error } = useQuery(IS_LOGGED_IN_VISAS_QUERY, { variables: { _id: isLoggedIn?._id } });

  const isLoggedInAnAdmin = UserVisas?.some((visa) => visa.n === "GREEN_CARD" && (!visa.eat || visa.eat > Date.now()));

  const sendMessage = async () => {
    setSending(true);
    if (fileToUpload) {
      let picData = new FormData();
      picData.append("file", fileToUpload);

      try {
        await axios.post("/api/chat/uploadAttachment", picData).then((response) => {
          if (response.data.url.substring(response.data.url.lastIndexOf(".") + 1) !== "zip" && response.data.url.substring(response.data.url.lastIndexOf(".") + 1) !== "pdf" && response.data.url.substring(response.data.url.lastIndexOf(".") + 1) !== "wav") {
            socket.emit("newMessage", {
              message: messageInput,
              pictures: response.data.url,
              room,
              ref: isLoggedIn ? isLoggedIn?._id : "Client",
            });
            setSending(false);
          } else if (response.data.url.substring(response.data.url.lastIndexOf(".") + 1) === "zip" || response.data.url.substring(response.data.url.lastIndexOf(".") + 1) === "pdf") {
            socket.emit("newMessage", {
              message: messageInput,
              attachment: response.data.url,
              room,
              ref: isLoggedIn ? isLoggedIn?._id : "Client",
            });
            setSending(false);
          } else if (response.data.url.substring(response.data.url.lastIndexOf(".") + 1) === "wav") {
            socket.emit("newMessage", {
              message: messageInput,
              voice: response.data.url,
              room,
              ref: isLoggedIn ? isLoggedIn?._id : "Client",
            });
            setSending(false);
          } else {
            setNotifications((prevNotifications) => [...prevNotifications, { status: true, message: "Failed to Fetch Data!" }]);
            setMessageInput("");
            setFile();
            setFileToUpload();
            setRecording(false);
            setVoiceURL(false);
            setVoiceDuration(0);
            setVoiceCurrentTime(0);
            setSending(false);
          }
        });
      } catch (error) {
        setNotifications((prevNotifications) => [...prevNotifications, { status: true, message: error.response.data.message }]);

        setSending(false);
        setMessageInput("");
        setFile();
        setFileToUpload();
      }
    } else {
      await socket.emit("newMessage", {
        message: messageInput,
        room,
        ref: isLoggedIn ? isLoggedIn?._id : "Client",
      });
      setSending(false);
    }
    socket?.emit("unreadCounts", { _id: isLoggedIn?._id });

    setMessageInput("");
    setFile();
    setFileToUpload();
    setRecording(false);
    setVoiceURL(false);
    setVoiceDuration(0);
    setVoiceCurrentTime(0);
    setIsSent(true);
  };

  // ↑ Emitting and On-ing ↑

  // ↓ Online/Offline Handling ↓

  useEffect(() => {
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onlineUsers]);

  const handleFocus = async () => {
    socket?.emit("onlineUsers", { user: isLoggedIn?._id, room });
    socket?.emit("changeMessagesStatusToRead", { user: isLoggedIn?._id, room });
  };

  const handleBlur = () => {
    if (onlineUsers) {
      socket.emit("onlineUsers", { user: "", room });
    }
  };

  // ↑ Online/Offline Status Handling ↑

  // ↓ Latest Message ↓

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView();
  }, [messages]);

  // ↑ Latest Message ↑

  //

  const setDeleteVoice = () => {
    setMessageInput("");
    setFile();
    setFileToUpload();
    setRecording(false);
    setVoiceURL(false);
    setVoiceDuration(0);
    setVoiceCurrentTime(0);
    setSending(false);
  };

  const selectFileForUpload = (event) => {
    event.preventDefault();
    if (event.target.files[0]?.type.includes("image")) {
      setOpenChatCropperModal({ status: true, index: 1 });
      const reader = new FileReader();
      reader.onload = () => {
        setFile(reader.result);
      };
      reader.readAsDataURL(event.target.files[0]);
    } else {
      setFileToUpload(event.target.files[0]);
    }
  };

  //

  const [isSent, setIsSent] = useState(false);

  //

  return (
    <>
      <div className={`z-50 relative w-[250px] animate-appearFast h-[400px]  shadow-[4px] border-[1px] border-solid border-gray-900 bg-gray-50 bg-blur rounded-t-lg rounded-bl-lg font-SofiaSansExtraCondensed overflow-auto`}>
        {/* ↓ Initiate Chat with Support ↓ */}

        {!isLoggedIn && !initiateChatWithSupport && (
          <div className="p-3">
            <div className="flex w-fit h-fit ">
              <div>
                <Image className="rounded-[50%] w-[50px] h-[50px] items-baseline brightness-125" src="https://mojtabamoradli.storage.iran.liara.space/Avatars/admin.jpg" width={50} height={50} alt="" />
                <div className={`relative float-right bottom-[15px] w-[10px] h-[10px] rounded-[50%] bg-red-500 `}></div>
              </div>
              <div className="ml-[10px]">
                <p className="text-gray-900 font-bold text-[20px] mt-[0px]">Mojtaba Moradli</p>
                <p className="text-[#00000050] text-[15px] leading-[15px]">Next.js Developer</p>
              </div>
            </div>
            <p className="bg-blue-50 text-[18px]  rounded-r-lg rounded-bl-lg border-[1px] border-solid border-gray-900 mt-2 p-2 shadow-lg font-extralight">
              Do you have any cool projects for me? <br /> Tell me all about it 🤩
            </p>

            <div className="mt-[110px] flex flex-col gap-[5px]">
              <input className="border-[1px]  border-solid border-gray-900   text-center placeholder:text-[#00000050] text-[20px] rounded-t-[4px] w-full h-[35px] focus:outline-none" type="text" value={allegedFullName} placeholder="Full Name" onChange={(event) => setAllegedFullName(event.target.value)} />
              <input className="border-[1px]  border-solid border-gray-900   text-center placeholder:text-[#00000050] text-[20px] rounded-b-[4px] w-full h-[35px] focus:outline-none" type="text" value={allegedCredential} placeholder="Email Address or Mobile Number" onChange={(event) => setAllegedCredential(event.target.value)} />
            </div>

            <button className={`w-full h-[35px] bg-gray-900 disabled:bg-gray-700 mt-[10px] text-white rounded-[4px] text-[20px]  transition-all duration-300`} disabled={!allegedFullName || !allegedCredential} onClick={letsChatWithAdminAsClient}>
              Lets Chat
            </button>
          </div>
        )}

        {/* ↑ Initiate Chat with Support ↑ */}

        {/* ↓ Contact Page ↓ */}

        {contacts && (
          <div>
            <div className="flex h-[80px] z-50 px-[12px] pt-[12px] gap-[12px] sticky  top-0 bg-gray-50 ">
              <button className="flex flex-col items-center hover:opacity-80 transition-all duration-300" onClick={letsChatWithMyself}>
                <div className="w-[45px] h-[45px]  bg-gray-200 border-[1px] border-dashed border-gray-900 rounded-[90%] flex justify-center items-center">
                  <svg width="24" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.93 22.75C4.51 22.75 4.12 22.65 3.77 22.45C3 22 2.56 21.09 2.56 19.96V5.86C2.56 3.32 4.63 1.25 7.17 1.25H16.82C19.36 1.25 21.43 3.32 21.43 5.86V19.95C21.43 21.08 20.99 21.99 20.22 22.44C19.45 22.89 18.44 22.84 17.45 22.29L12.57 19.58C12.28 19.42 11.71 19.42 11.42 19.58L6.54 22.29C6 22.59 5.45 22.75 4.93 22.75ZM7.18 2.75C5.47 2.75 4.07 4.15 4.07 5.86V19.95C4.07 20.54 4.24 20.98 4.54 21.15C4.84 21.32 5.31 21.27 5.82 20.98L10.7 18.27C11.44 17.86 12.56 17.86 13.3 18.27L18.18 20.98C18.69 21.27 19.16 21.33 19.46 21.15C19.76 20.97 19.93 20.53 19.93 19.95V5.86C19.93 4.15 18.53 2.75 16.82 2.75H7.18Z" fill="#9CA3AF" />
                  </svg>
                </div>
                <p className="text-[13px] font-bold">Saved Messages</p>
              </button>
              <button
                className="flex flex-col items-center hover:opacity-80 transition-all duration-300"
                onClick={() => {
                  setLetsCreateNewGroup(true);
                  openGroupsTab();
                }}>
                <div className="w-[45px] h-[45px] bg-gray-200 border-[1px] border-dashed border-gray-900 rounded-[90%] flex justify-center items-center">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 12.75H6C5.59 12.75 5.25 12.41 5.25 12C5.25 11.59 5.59 11.25 6 11.25H18C18.41 11.25 18.75 11.59 18.75 12C18.75 12.41 18.41 12.75 18 12.75Z" fill="#9CA3AF" />
                    <path d="M12 18.75C11.59 18.75 11.25 18.41 11.25 18V6C11.25 5.59 11.59 5.25 12 5.25C12.41 5.25 12.75 5.59 12.75 6V18C12.75 18.41 12.41 18.75 12 18.75Z" fill="#9CA3AF" />
                  </svg>
                </div>

                <p className="text-[13px] font-bold">New Group</p>
              </button>
            </div>

            <div className="flex flex-col  gap-2 overflow-hidden h-[318px] bg-[#00000010] shadow-xl rounded-xl px-3">
              <div className="flex gap-[1px] justify-center mt-2 w-full ">
                <button onClick={openUsersTab} className={`bg-gray-900 w-full text-gray-100 px-2 hover:opacity-80 transition-all duration-300 rounded-l-lg ${usersTab && "opacity-80"}`}>
                  Users
                </button>
                <button onClick={openGroupsTab} className={`bg-gray-900 w-full text-gray-100 px-2 hover:opacity-80 transition-all duration-300 ${!isLoggedInAnAdmin && "rounded-r-lg"} ${groupsTab && "opacity-80"}`}>
                  Groups
                </button>
                {isLoggedInAnAdmin && (
                  <button onClick={openClientsTab} className={`bg-gray-900 w-full text-gray-100 px-2 hover:opacity-80 transition-all duration-300 rounded-r-lg ${clientsTab && "opacity-80"}`}>
                    Clients
                  </button>
                )}
              </div>
              <div className=" h-full overflow-y-auto ">
                {groupsTab && letsCreateNewGroup && (
                  <div>
                    {letsCreateNewGroup && (
                      <div className="absolute bg-[#ededee] pr-[2px] pb-[1px] rounded-b-lg overflow-x-clip">
                        <div className="flex gap-[2px] ">
                          <input className="border-[1px]  border-solid border-gray-900   text-center placeholder:text-[#00000050] text-[20px] rounded-l-[4px] w-[108px] h-[35px] focus:outline-none" placeholder="Group Name" onChange={(event) => setNewGroupName(event.target.value)} />
                          <button className={`w-[60px] h-[35px] bg-gray-900  text-white  text-[20px]  transition-all duration-300 disabled:bg-gray-700`} disabled={!newGroupName} onClick={createNewGroup}>
                            Create
                          </button>
                          <button className={`w-[50px] h-[35px] bg-gray-900  text-white rounded-r-[4px] text-[20px]  transition-all duration-300`} onClick={() => setLetsCreateNewGroup(false)}>
                            Cancel
                          </button>
                        </div>
                        <p className="mt-[10px] ml-[5px]">Select Members, {newGroupMembers.length} selected</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 pt-[80px]  h-full">
                      {letsCreateNewGroup &&
                        users &&
                        users
                          ?.filter((user) => user._id !== isLoggedIn._id)
                          .map(({ _id, firstName, lastName }, index) => (
                            <label key={index} className={`cursor-pointer ${newGroupMembers.includes(_id) ? "bg-green-200" : "bg-[#ffffff90] hover:bg-white"} w-full animate-appearFast flex items-center h-[40px]  border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1  transition-all duration-300`}>
                              <input className="hidden" type="checkbox" onChange={() => addToNewGroupMembersList(_id)} />
                              <div className="w-[25px] h-[25px] bg-gray-300 border-gray-900 rounded-lg border-b-[1px]"></div>

                              <div className="flex ml-[5px] font-semibold">
                                <p>
                                  {firstName} {lastName}
                                </p>
                              </div>
                            </label>
                          ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 last:mb-[10px] ">
                  {usersTab &&
                    users &&
                    users
                      ?.filter((user) => user._id !== isLoggedIn._id)
                      .map(({ _id, firstName, lastName }, index) => (
                        <button key={index} className="w-full animate-appearFast flex items-center h-[50px] justify-between border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1 bg-[#ffffff90] hover:bg-white transition-all duration-300" onClick={() => !letsCreateNewGroup && letsPrivateChat({ _id, firstName, lastName })}>
                          <div className="flex items-center">
                            <div className={` w-[40px] h-[40px] bg-gray-300 rounded-lg border-b-[3px] ${onlineUsers?.user == _id ? "border-green-500" : "border-red-500"} flex items-center justify-center mx-auto`}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 12.75C8.83 12.75 6.25 10.17 6.25 7C6.25 3.83 8.83 1.25 12 1.25C15.17 1.25 17.75 3.83 17.75 7C17.75 10.17 15.17 12.75 12 12.75ZM12 2.75C9.66 2.75 7.75 4.66 7.75 7C7.75 9.34 9.66 11.25 12 11.25C14.34 11.25 16.25 9.34 16.25 7C16.25 4.66 14.34 2.75 12 2.75Z" fill="#9CA3AF" />
                                <path d="M3.41016 22.75C3.00016 22.75 2.66016 22.41 2.66016 22C2.66016 17.73 6.85015 14.25 12.0002 14.25C13.0102 14.25 14.0001 14.38 14.9601 14.65C15.3601 14.76 15.5902 15.17 15.4802 15.57C15.3702 15.97 14.9601 16.2 14.5602 16.09C13.7402 15.86 12.8802 15.75 12.0002 15.75C7.68015 15.75 4.16016 18.55 4.16016 22C4.16016 22.41 3.82016 22.75 3.41016 22.75Z" fill="#9CA3AF" />
                                <path d="M18 22.75C16.34 22.75 14.78 21.87 13.94 20.44C13.49 19.72 13.25 18.87 13.25 18C13.25 16.54 13.9 15.19 15.03 14.29C15.87 13.62 16.93 13.25 18 13.25C20.62 13.25 22.75 15.38 22.75 18C22.75 18.87 22.51 19.72 22.06 20.45C21.81 20.87 21.49 21.25 21.11 21.57C20.28 22.33 19.17 22.75 18 22.75ZM18 14.75C17.26 14.75 16.56 15 15.97 15.47C15.2 16.08 14.75 17.01 14.75 18C14.75 18.59 14.91 19.17 15.22 19.67C15.8 20.65 16.87 21.25 18 21.25C18.79 21.25 19.55 20.96 20.13 20.44C20.39 20.22 20.61 19.96 20.77 19.68C21.09 19.17 21.25 18.59 21.25 18C21.25 16.21 19.79 14.75 18 14.75Z" fill="#9CA3AF" />
                                <path d="M17.4299 19.7401C17.2399 19.7401 17.0499 19.6701 16.8999 19.5201L15.9099 18.5301C15.6199 18.2401 15.6199 17.76 15.9099 17.47C16.1999 17.18 16.6799 17.18 16.9699 17.47L17.4499 17.9501L19.0499 16.47C19.3499 16.19 19.8299 16.2101 20.1099 16.5101C20.3899 16.8101 20.3699 17.2901 20.0699 17.5701L17.9399 19.54C17.7899 19.67 17.6099 19.7401 17.4299 19.7401Z" fill="#9CA3AF" />
                              </svg>
                            </div>

                            <div className="text-left ml-[5px] leading-[20px]">
                              <p className="font-bold whitespace-nowrap">
                                {firstName} {lastName}
                              </p>
                              <p className="text-[12px] text-gray-400">
                                {unreadCounts && unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat?.ref == isLoggedIn?._id ? <span className="font-semibold">You :</span> : <span className="font-semibold">{unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`) && unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat?.refFirstName + " :"}</span>}
                                <span> {unreadCounts && unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat.message.length > 15 ? unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat.message.slice(0, 15) + "..." : unreadCounts?.find((item) => item.room === `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat.message}</span>
                              </p>
                            </div>
                          </div>
                          <div className="h-full w-[80px] text-right flex flex-col leading-[20px]">
                            <p className={`text-gray-100 m-[2px] relative right-[-30px] text-[12px] rounded-xl ${unreadCounts?.find((item) => item.room === `${[_id, isLoggedIn?._id].sort().join("-")}` && item.ref !== isLoggedIn?._id)?.unreadMessagesCount ? "bg-red-500" : ""} w-[15px] h-[15px] flex items-center justify-center mx-auto`}>{unreadCounts?.find((item) => item.room === `${[_id, isLoggedIn?._id].sort().join("-")}` && item.ref !== isLoggedIn?._id)?.unreadMessagesCount}</p>
                            <p className="text-[12px] whitespace-nowrap text-gray-400">{unreadCounts?.find((item) => item.room == `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat?.createdAt && formatDistanceToNow(new Date(unreadCounts.find((item) => item.room === `${[_id, isLoggedIn?._id].sort().join("-")}`)?.latestChat?.createdAt), { addSuffix: true })}</p>
                          </div>
                        </button>
                      ))}
                </div>

                <div className="flex flex-col gap-2 last:mb-[10px]">
                  {groupsTab &&
                    !letsCreateNewGroup &&
                    userGroups &&
                    userGroups?.map(({ _id, name, room, members, masters, createdAt, avatar, latestChat }, index) => (
                      <button key={index} className="w-full animate-appearFast  flex items-center h-[50px] justify-between border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1 bg-[#ffffff90] hover:bg-white transition-all duration-300" onClick={() => letsGroupChat({ _id, name, room, members, masters, createdAt, avatar })}>
                        <div className="flex items-center">
                          <div className={` w-[40px] h-[40px] bg-gray-300 rounded-lg border-b-[3px] border-gray-900 flex items-center justify-center mx-auto`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.9998 7.91002C17.9698 7.91002 17.9498 7.91002 17.9198 7.91002H17.8698C15.9798 7.85002 14.5698 6.39001 14.5698 4.59001C14.5698 2.75001 16.0698 1.26001 17.8998 1.26001C19.7298 1.26001 21.2298 2.76001 21.2298 4.59001C21.2198 6.40001 19.8098 7.86001 18.0098 7.92001C18.0098 7.91001 18.0098 7.91002 17.9998 7.91002ZM17.8998 2.75002C16.8898 2.75002 16.0698 3.57002 16.0698 4.58002C16.0698 5.57002 16.8398 6.37002 17.8298 6.41002C17.8398 6.40002 17.9198 6.40002 18.0098 6.41002C18.9798 6.36002 19.7298 5.56002 19.7398 4.58002C19.7398 3.57002 18.9198 2.75002 17.8998 2.75002Z" fill="#9CA3AF" />
                              <path d="M18.01 15.2801C17.62 15.2801 17.23 15.2501 16.84 15.1801C16.43 15.1101 16.16 14.7201 16.23 14.3101C16.3 13.9001 16.69 13.6301 17.1 13.7001C18.33 13.9101 19.63 13.6802 20.5 13.1002C20.97 12.7902 21.22 12.4001 21.22 12.0101C21.22 11.6201 20.96 11.2401 20.5 10.9301C19.63 10.3501 18.31 10.1201 17.07 10.3401C16.66 10.4201 16.27 10.1401 16.2 9.73015C16.13 9.32015 16.4 8.93015 16.81 8.86015C18.44 8.57015 20.13 8.88014 21.33 9.68014C22.21 10.2701 22.72 11.1101 22.72 12.0101C22.72 12.9001 22.22 13.7502 21.33 14.3502C20.42 14.9502 19.24 15.2801 18.01 15.2801Z" fill="#9CA3AF" />
                              <path d="M5.96998 7.91C5.95998 7.91 5.94998 7.91 5.94998 7.91C4.14998 7.85 2.73998 6.39 2.72998 4.59C2.72998 2.75 4.22998 1.25 6.05998 1.25C7.88998 1.25 9.38998 2.75 9.38998 4.58C9.38998 6.39 7.97998 7.85 6.17998 7.91L5.96998 7.16L6.03998 7.91C6.01998 7.91 5.98998 7.91 5.96998 7.91ZM6.06998 6.41C6.12998 6.41 6.17998 6.41 6.23998 6.42C7.12998 6.38 7.90998 5.58 7.90998 4.59C7.90998 3.58 7.08998 2.75999 6.07998 2.75999C5.06998 2.75999 4.24998 3.58 4.24998 4.59C4.24998 5.57 5.00998 6.36 5.97998 6.42C5.98998 6.41 6.02998 6.41 6.06998 6.41Z" fill="#9CA3AF" />
                              <path d="M5.96 15.2801C4.73 15.2801 3.55 14.9502 2.64 14.3502C1.76 13.7602 1.25 12.9101 1.25 12.0101C1.25 11.1201 1.76 10.2701 2.64 9.68014C3.84 8.88014 5.53 8.57015 7.16 8.86015C7.57 8.93015 7.84 9.32015 7.77 9.73015C7.7 10.1401 7.31 10.4201 6.9 10.3401C5.66 10.1201 4.35 10.3501 3.47 10.9301C3 11.2401 2.75 11.6201 2.75 12.0101C2.75 12.4001 3.01 12.7902 3.47 13.1002C4.34 13.6802 5.64 13.9101 6.87 13.7001C7.28 13.6301 7.67 13.9101 7.74 14.3101C7.81 14.7201 7.54 15.1101 7.13 15.1801C6.74 15.2501 6.35 15.2801 5.96 15.2801Z" fill="#9CA3AF" />
                              <path d="M11.9998 15.38C11.9698 15.38 11.9498 15.38 11.9198 15.38H11.8698C9.97982 15.32 8.56982 13.86 8.56982 12.06C8.56982 10.22 10.0698 8.72998 11.8998 8.72998C13.7298 8.72998 15.2298 10.23 15.2298 12.06C15.2198 13.87 13.8098 15.33 12.0098 15.39C12.0098 15.38 12.0098 15.38 11.9998 15.38ZM11.8998 10.22C10.8898 10.22 10.0698 11.04 10.0698 12.05C10.0698 13.04 10.8398 13.84 11.8298 13.88C11.8398 13.87 11.9198 13.87 12.0098 13.88C12.9798 13.83 13.7298 13.03 13.7398 12.05C13.7398 11.05 12.9198 10.22 11.8998 10.22Z" fill="#9CA3AF" />
                              <path d="M11.9998 22.76C10.7998 22.76 9.59978 22.45 8.66978 21.82C7.78978 21.23 7.27979 20.39 7.27979 19.49C7.27979 18.6 7.77978 17.74 8.66978 17.15C10.5398 15.91 13.4698 15.91 15.3298 17.15C16.2098 17.74 16.7198 18.58 16.7198 19.48C16.7198 20.37 16.2198 21.23 15.3298 21.82C14.3998 22.44 13.1998 22.76 11.9998 22.76ZM9.49979 18.41C9.02979 18.72 8.77979 19.11 8.77979 19.5C8.77979 19.89 9.03979 20.27 9.49979 20.58C10.8498 21.49 13.1398 21.49 14.4898 20.58C14.9598 20.27 15.2098 19.88 15.2098 19.49C15.2098 19.1 14.9498 18.72 14.4898 18.41C13.1498 17.5 10.8598 17.51 9.49979 18.41Z" fill="#9CA3AF" />
                            </svg>
                          </div>

                          <div className="text-left ml-[5px] leading-[20px]">
                            <p className="font-bold whitespace-nowrap">{name}</p>
                            <p className="text-[12px] text-gray-400">
                              {latestChat && latestChat?.ref == isLoggedIn?._id ? <span className="font-semibold">You :</span> : <span className="font-semibold">{latestChat && latestChat?.refFirstName + " :"}</span>}
                              <span> {latestChat && latestChat?.message.length > 15 ? latestChat?.message.slice(0, 15) + "..." : latestChat?.message}</span>
                            </p>
                          </div>
                        </div>
                        <div className="h-full w-[80px] text-right  flex flex-col leading-[20px]">
                          <p className="text-[12px] mt-[18px] whitespace-nowrap  text-gray-400">{latestChat && latestChat?.createdAt && formatDistanceToNow(new Date(latestChat?.createdAt), { addSuffix: true })}</p>
                        </div>
                      </button>
                    ))}
                </div>

                <div className="flex flex-col gap-2 last:mb-[10px]">
                  {clientsTab &&
                    isLoggedInAnAdmin &&
                    clients &&
                    clients
                      ?.map(({ allegedFullName, allegedCredential, room, roomUnreadChats, latestChat }, index) => (
                        <button key={index} className="w-full animate-appearFast  flex items-center h-[50px] justify-between border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1 bg-[#ffffff90] hover:bg-white transition-all duration-300" onClick={() => letsChatWithClientsAsAdmin({ allegedFullName, allegedCredential, room })}>
                          <div className="flex items-center">
                            <div className={` w-[40px] h-[40px] bg-gray-300 rounded-lg border-b-[3px] border-gray-900 flex items-center justify-center mx-auto`}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.1601 11.62C12.1301 11.62 12.1101 11.62 12.0801 11.62C12.0301 11.61 11.9601 11.61 11.9001 11.62C9.00006 11.53 6.81006 9.25 6.81006 6.44C6.81006 3.58 9.14006 1.25 12.0001 1.25C14.8601 1.25 17.1901 3.58 17.1901 6.44C17.1801 9.25 14.9801 11.53 12.1901 11.62C12.1801 11.62 12.1701 11.62 12.1601 11.62ZM12.0001 2.75C9.97006 2.75 8.31006 4.41 8.31006 6.44C8.31006 8.44 9.87006 10.05 11.8601 10.12C11.9101 10.11 12.0501 10.11 12.1801 10.12C14.1401 10.03 15.6801 8.42 15.6901 6.44C15.6901 4.41 14.0301 2.75 12.0001 2.75Z" fill="#9CA3AF" />
                                <path d="M12.1701 22.55C10.2101 22.55 8.2401 22.05 6.7501 21.05C5.3601 20.13 4.6001 18.87 4.6001 17.5C4.6001 16.13 5.3601 14.86 6.7501 13.93C9.7501 11.94 14.6101 11.94 17.5901 13.93C18.9701 14.85 19.7401 16.11 19.7401 17.48C19.7401 18.85 18.9801 20.12 17.5901 21.05C16.0901 22.05 14.1301 22.55 12.1701 22.55ZM7.5801 15.19C6.6201 15.83 6.1001 16.65 6.1001 17.51C6.1001 18.36 6.6301 19.18 7.5801 19.81C10.0701 21.48 14.2701 21.48 16.7601 19.81C17.7201 19.17 18.2401 18.35 18.2401 17.49C18.2401 16.64 17.7101 15.82 16.7601 15.19C14.2701 13.53 10.0701 13.53 7.5801 15.19Z" fill="#9CA3AF" />
                              </svg>
                            </div>

                            <div className="text-left ml-[5px] leading-[20px]">
                              <p className="font-bold whitespace-nowrap">{allegedFullName}</p>
                              <p className="text-[12px] text-gray-400">
                                {latestChat && <span className="font-semibold">{allegedFullName} :</span>}
                                <span> {latestChat?.message?.length > 15 ? latestChat?.message.slice(0, 15) + "..." : latestChat?.message} {!latestChat?.message && "attachment"} </span>
                              </p>
                            </div>
                          </div>
                          <div className="h-full w-[80px] text-right flex flex-col leading-[20px]">
                            <p className={`text-gray-100 m-[2px] relative right-[-30px] text-[12px] rounded-xl ${roomUnreadChats ? "bg-red-500" : ""} w-[15px] h-[15px] flex items-center justify-center mx-auto`}>{roomUnreadChats}</p>
                            <p className="text-[12px] whitespace-nowrap text-gray-400">{latestChat?.createdAt && formatDistanceToNow(new Date(latestChat?.createdAt), { addSuffix: true })}</p>
                          </div>
                        </button>
                      ))
                      .reverse()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ↑ Contact Page ↑ */}

        {/* ↓ Chat Page ↓ */}

        {(initiateChatWithSupport || (isLoggedIn && !contacts)) && (
          <div className="overflow-clip  ">
            {/* ↓ Chat Header Toolbar ↓ */}
            <div>
              <div className={`h-[45px] flex justify-between px-3 items-center bg-[#ffffff90] border-b-[1px] border-gray-900 shadow-md rounded-b-lg`}>
                {isLoggedIn && (
                  <div className="flex ">
                    <svg
                      className="cursor-pointer"
                      onClick={() => {
                        addMember ? setAddMember(false) : openGroupMenu ? setOpenGroupMenu(false) : setContacts(true);
                      }}
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.56994 18.82C9.37994 18.82 9.18994 18.75 9.03994 18.6L2.96994 12.53C2.67994 12.24 2.67994 11.76 2.96994 11.47L9.03994 5.4C9.32994 5.11 9.80994 5.11 10.0999 5.4C10.3899 5.69 10.3899 6.17 10.0999 6.46L4.55994 12L10.0999 17.54C10.3899 17.83 10.3899 18.31 10.0999 18.6C9.95994 18.75 9.75994 18.82 9.56994 18.82Z" fill="#292D32" />
                      <path d="M20.4999 12.75H3.66992C3.25992 12.75 2.91992 12.41 2.91992 12C2.91992 11.59 3.25992 11.25 3.66992 11.25H20.4999C20.9099 11.25 21.2499 11.59 21.2499 12C21.2499 12.41 20.9099 12.75 20.4999 12.75Z" fill="#292D32" />
                    </svg>
                  </div>
                )}
                <div>
                  <p
                    className={`text-gray-900 font-semibold  ${group?._id && !openGroupMenu && "cursor-pointer"}`}
                    onClick={() => {
                      group?._id && setOpenGroupMenu(true);
                    }}>
                    {chatRoomData.chatTitle} {allegedFullName && <span> / {allegedFullName}</span>}
                  </p>
                </div>
                <div>
                  {chatRoomData && chatRoomData.avatar ? (
                    <div>
                      <Image className={`rounded-lg ${onlineUsers?.user === chatRoomData?._id ? "border-green-500" : "border-red-500"} `} src={chatRoomData.avatar} width={30} height={30} alt="" />
                    </div>
                  ) : (
                    <div className={`w-[30px] h-[30px] bg-gray-300 ${onlineUsers?.user === chatRoomData?._id ? "border-green-500" : "border-red-500"} rounded-lg border-b-[3px]`}></div>
                  )}
                </div>
              </div>
              <div className={`${!openGroupMenu && "h-[18px]"}`}>{!openGroupMenu && <p className="flex  mx-auto justify-center text-[10px] bg-transparent mt-[-18px] pt-[2px] text-[#00000090]">{isLoggedIn && typingStatus.status && typingStatus.user !== isLoggedIn._id && <p>{typingStatus.userName + "..."}</p>}</p>}</div>
            </div>

            {/* ↑ Chat Header Toolbar ↑ */}

            {/* ↓ Chat Messages ↓ */}

            {!openGroupMenu && (
              <div className="h-[350px] pb-[50px] overflow-y-scroll px-3">
                <div className="w-[100%]">
                  {messages?.length
                    ? messages?.map(({ _id, ref, room, message, pictures, attachment, voice, read, createdAt, refFirstName, refLastName }, index) => (
                        <li key={index} className="list-none  w-[100%] animate-appearFast">
                          <div className={`flex ${ref === isLoggedIn?._id && "flex-row-reverse "} mt-2 whitespace-nowrap`}>
                            {ref !== messages[index - 1]?.ref && (
                              <span className="text-[#00000050]">
                                {refFirstName} {refLastName} 
                              </span>
                            )}
                          </div>
                          <span>
                            <div className={`${ref === isLoggedIn?._id || (!isLoggedIn?._id && ref === "Client") ? "bg-gray-100 rounded-l-lg rounded-br-lg" : "bg-blue-50 rounded-r-lg rounded-bl-lg"}  pb-[20px] leading-[20px] border-[1px] border-solid ${deleteMessage.status && deleteMessage._id === _id ? "border-red-500 bg-red-50" : "border-gray-900"} ${editMessage.status && editMessage._id === _id ? "border-orange-500 bg-orange-50" : "border-gray-900"} mt-[2px] p-2 ${ref === isLoggedIn?._id && "pb-4"} shadow-lg min-w-[100px] `}>
                              <p className="text-[18px] font-extralight">{message}</p>
                              <div className="flex gap-[5px] flex-wrap">
                                {pictures &&
                                  pictures.length > 0 &&
                                  pictures.map((picture, index) => (
                                    <div key={index} className="w-fit">
                                      <Link className="" href={picture} target="_blank">
                                        <Image className={`rounded-[10%] `} src={picture} width={50} height={50} alt="" />
                                      </Link>
                                    </div>
                                  ))}
                              </div>
                              {attachment && (
                                <div className="w-fit h-fit">
                                  <Link className="w-fit" href={attachment} target="_blank">
                                    Download File
                                  </Link>
                                </div>
                              )}

                              {voice && <VoiceMessagePlayer voice={voice} />}

                              {editMessage.status && editMessage._id === _id && (
                                <div className="flex gap-[3px] w-full">
                                  <textarea  className="border-[1px] border-solid border-orange-500 transition-all duration-300 resize-y rounded-md my-1 pl-1 w-full h-auto focus:outline-none" onChange={(event) => setEditedMessage(event.target.value)} defaultValue={message} />
                                </div>
                              )}
                              <div className={` flex items-center float-right mr-[5px] mt-[-2px]  ${ref !== isLoggedIn?._id && "mt-[-11px]"}`}>
                                {isLoggedIn?._id && ref === isLoggedIn?._id && (
                                  <div className="flex">
                                    {!deleteMessage.status && !editMessage.status && (
                                      <svg onClick={() => setDeleteMessage({ status: true, _id })} className="cursor-pointer align-bottom" width="14" height="14" fill="none" viewBox="0 0 24 24">
                                        <path d="M21 6.72998C20.98 6.72998 20.95 6.72998 20.92 6.72998C15.63 6.19998 10.35 5.99998 5.12 6.52998L3.08 6.72998C2.66 6.76998 2.29 6.46998 2.25 6.04998C2.21 5.62998 2.51 5.26998 2.92 5.22998L4.96 5.02998C10.28 4.48998 15.67 4.69998 21.07 5.22998C21.48 5.26998 21.78 5.63998 21.74 6.04998C21.71 6.43998 21.38 6.72998 21 6.72998Z" fill="#292D3250" />
                                        <path d="M8.5 5.72C8.46 5.72 8.42 5.72 8.37 5.71C7.97 5.64 7.69 5.25 7.76 4.85L7.98 3.54C8.14 2.58 8.36 1.25 10.69 1.25H13.31C15.65 1.25 15.87 2.63 16.02 3.55L16.24 4.85C16.31 5.26 16.03 5.65 15.63 5.71C15.22 5.78 14.83 5.5 14.77 5.1L14.55 3.8C14.41 2.93 14.38 2.76 13.32 2.76H10.7C9.64 2.76 9.62 2.9 9.47 3.79L9.24 5.09C9.18 5.46 8.86 5.72 8.5 5.72Z" fill="#292D3250" />
                                        <path d="M15.21 22.75H8.79C5.3 22.75 5.16 20.82 5.05 19.26L4.4 9.18995C4.37 8.77995 4.69 8.41995 5.1 8.38995C5.52 8.36995 5.87 8.67995 5.9 9.08995L6.55 19.16C6.66 20.68 6.7 21.25 8.79 21.25H15.21C17.31 21.25 17.35 20.68 17.45 19.16L18.1 9.08995C18.13 8.67995 18.49 8.36995 18.9 8.38995C19.31 8.41995 19.63 8.76995 19.6 9.18995L18.95 19.26C18.84 20.82 18.7 22.75 15.21 22.75Z" fill="#292D3250" />
                                        <path d="M13.66 17.25H10.33C9.92 17.25 9.58 16.91 9.58 16.5C9.58 16.09 9.92 15.75 10.33 15.75H13.66C14.07 15.75 14.41 16.09 14.41 16.5C14.41 16.91 14.07 17.25 13.66 17.25Z" fill="#292D3250" />
                                        <path d="M14.5 13.25H9.5C9.09 13.25 8.75 12.91 8.75 12.5C8.75 12.09 9.09 11.75 9.5 11.75H14.5C14.91 11.75 15.25 12.09 15.25 12.5C15.25 12.91 14.91 13.25 14.5 13.25Z" fill="#292D3250" />
                                      </svg>
                                    )}

                                    {deleteMessage.status && deleteMessage._id === _id && (
                                      <div className="flex gap-[2px] mr-1">
                                        <svg onClick={() => deleteMessageById(_id)} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer align-bottom">
                                          <path d="M15 22.75H9C3.57 22.75 1.25 20.43 1.25 15V9C1.25 3.57 3.57 1.25 9 1.25H15C20.43 1.25 22.75 3.57 22.75 9V15C22.75 20.43 20.43 22.75 15 22.75ZM9 2.75C4.39 2.75 2.75 4.39 2.75 9V15C2.75 19.61 4.39 21.25 9 21.25H15C19.61 21.25 21.25 19.61 21.25 15V9C21.25 4.39 19.61 2.75 15 2.75H9Z" fill="#22C55E" />
                                          <path d="M10.58 15.58C10.38 15.58 10.19 15.5 10.05 15.36L7.22 12.53C6.93 12.24 6.93 11.76 7.22 11.47C7.51 11.18 7.99 11.18 8.28 11.47L10.58 13.77L15.72 8.62998C16.01 8.33998 16.49 8.33998 16.78 8.62998C17.07 8.91998 17.07 9.39998 16.78 9.68998L11.11 15.36C10.97 15.5 10.78 15.58 10.58 15.58Z" fill="#22C55E" />
                                        </svg>

                                        <svg onClick={() => setDeleteMessage({ status: false, _id: null })} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer align-bottom">
                                          <path d="M9.17 15.58C8.98 15.58 8.79 15.51 8.64 15.36C8.35 15.07 8.35 14.59 8.64 14.3L14.3 8.63999C14.59 8.34999 15.07 8.34999 15.36 8.63999C15.65 8.92999 15.65 9.40998 15.36 9.69998L9.7 15.36C9.56 15.51 9.36 15.58 9.17 15.58Z" fill="#DC2626" />
                                          <path d="M14.83 15.58C14.64 15.58 14.45 15.51 14.3 15.36L8.64 9.69998C8.35 9.40998 8.35 8.92999 8.64 8.63999C8.93 8.34999 9.41 8.34999 9.7 8.63999L15.36 14.3C15.65 14.59 15.65 15.07 15.36 15.36C15.21 15.51 15.02 15.58 14.83 15.58Z" fill="#DC2626" />
                                          <path d="M15 22.75H9C3.57 22.75 1.25 20.43 1.25 15V9C1.25 3.57 3.57 1.25 9 1.25H15C20.43 1.25 22.75 3.57 22.75 9V15C22.75 20.43 20.43 22.75 15 22.75ZM9 2.75C4.39 2.75 2.75 4.39 2.75 9V15C2.75 19.61 4.39 21.25 9 21.25H15C19.61 21.25 21.25 19.61 21.25 15V9C21.25 4.39 19.61 2.75 15 2.75H9Z" fill="#DC2626" />
                                        </svg>
                                      </div>
                                    )}

                                    {!voice && !editMessage.status && !deleteMessage.status && (
                                      <svg onClick={() => setEditMessage({ status: true, _id })} width="14" height="14" fill="none" viewBox="0 0 24 24" className="cursor-pointer mr-[3px] rotate-[136deg]">
                                        <path d="M5.53999 19.52C4.92999 19.52 4.35999 19.31 3.94999 18.92C3.42999 18.43 3.17999 17.69 3.26999 16.89L3.63999 13.65C3.70999 13.04 4.07999 12.23 4.50999 11.79L12.72 3.09999C14.77 0.929988 16.91 0.869988 19.08 2.91999C21.25 4.96999 21.31 7.10999 19.26 9.27999L11.05 17.97C10.63 18.42 9.84999 18.84 9.23999 18.94L6.01999 19.49C5.84999 19.5 5.69999 19.52 5.53999 19.52ZM15.93 2.90999C15.16 2.90999 14.49 3.38999 13.81 4.10999L5.59999 12.81C5.39999 13.02 5.16999 13.52 5.12999 13.81L4.75999 17.05C4.71999 17.38 4.79999 17.65 4.97999 17.82C5.15999 17.99 5.42999 18.05 5.75999 18L8.97999 17.45C9.26999 17.4 9.74999 17.14 9.94999 16.93L18.16 8.23999C19.4 6.91999 19.85 5.69999 18.04 3.99999C17.24 3.22999 16.55 2.90999 15.93 2.90999Z" fill="#292D3250" />
                                        <path d="M17.34 10.95C17.32 10.95 17.29 10.95 17.27 10.95C14.15 10.64 11.64 8.26997 11.16 5.16997C11.1 4.75997 11.38 4.37997 11.79 4.30997C12.2 4.24997 12.58 4.52997 12.65 4.93997C13.03 7.35997 14.99 9.21997 17.43 9.45997C17.84 9.49997 18.14 9.86997 18.1 10.28C18.05 10.66 17.72 10.95 17.34 10.95Z" fill="#292D3250" />{" "}
                                      </svg>
                                    )}

                                    {editMessage.status && editMessage._id === _id && (
                                      <div className="flex  gap-[2px] mr-1">
                                        <svg onClick={() => editMessageById(_id)} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer align-bottom">
                                          <path d="M15 22.75H9C3.57 22.75 1.25 20.43 1.25 15V9C1.25 3.57 3.57 1.25 9 1.25H15C20.43 1.25 22.75 3.57 22.75 9V15C22.75 20.43 20.43 22.75 15 22.75ZM9 2.75C4.39 2.75 2.75 4.39 2.75 9V15C2.75 19.61 4.39 21.25 9 21.25H15C19.61 21.25 21.25 19.61 21.25 15V9C21.25 4.39 19.61 2.75 15 2.75H9Z" fill="#22C55E" />
                                          <path d="M10.58 15.58C10.38 15.58 10.19 15.5 10.05 15.36L7.22 12.53C6.93 12.24 6.93 11.76 7.22 11.47C7.51 11.18 7.99 11.18 8.28 11.47L10.58 13.77L15.72 8.62998C16.01 8.33998 16.49 8.33998 16.78 8.62998C17.07 8.91998 17.07 9.39998 16.78 9.68998L11.11 15.36C10.97 15.5 10.78 15.58 10.58 15.58Z" fill="#22C55E" />
                                        </svg>

                                        <svg onClick={() => setEditMessage({ status: false, _id: null })} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer align-bottom">
                                          <path d="M9.17 15.58C8.98 15.58 8.79 15.51 8.64 15.36C8.35 15.07 8.35 14.59 8.64 14.3L14.3 8.63999C14.59 8.34999 15.07 8.34999 15.36 8.63999C15.65 8.92999 15.65 9.40998 15.36 9.69998L9.7 15.36C9.56 15.51 9.36 15.58 9.17 15.58Z" fill="#DC2626" />
                                          <path d="M14.83 15.58C14.64 15.58 14.45 15.51 14.3 15.36L8.64 9.69998C8.35 9.40998 8.35 8.92999 8.64 8.63999C8.93 8.34999 9.41 8.34999 9.7 8.63999L15.36 14.3C15.65 14.59 15.65 15.07 15.36 15.36C15.21 15.51 15.02 15.58 14.83 15.58Z" fill="#DC2626" />
                                          <path d="M15 22.75H9C3.57 22.75 1.25 20.43 1.25 15V9C1.25 3.57 3.57 1.25 9 1.25H15C20.43 1.25 22.75 3.57 22.75 9V15C22.75 20.43 20.43 22.75 15 22.75ZM9 2.75C4.39 2.75 2.75 4.39 2.75 9V15C2.75 19.61 4.39 21.25 9 21.25H15C19.61 21.25 21.25 19.61 21.25 15V9C21.25 4.39 19.61 2.75 15 2.75H9Z" fill="#DC2626" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <span className={`text-[#00000050] mr-[3px] text-[10px] `}> {new Date(createdAt).toLocaleTimeString("fa-IR-u-nu-latn").slice(0, 5)} </span>

                                {ref == isLoggedIn?._id && !group._id && (
                                  <div>
                                    {read ? (
                                      <div className="flex">
                                        <svg width="8" height="7" fill="none" viewBox="0 0 8 7">
                                          <path d="M2.65999 6.23012C2.46999 6.23012 2.27999 6.16012 2.12999 6.01012L0.51999 4.40012C0.22999 4.11012 0.22999 3.63012 0.51999 3.34012C0.80999 3.05012 1.28999 3.05012 1.57999 3.34012L2.65999 4.42012L6.42999 0.650117C6.71999 0.360117 7.19999 0.360117 7.48999 0.650117C7.77999 0.940117 7.77999 1.42012 7.48999 1.71012L3.18999 6.01012C3.03999 6.16012 2.84999 6.23012 2.65999 6.23012Z" fill="#18a24b" />{" "}
                                        </svg>
                                        <svg width="8" height="7" fill="none" viewBox="0 0 8 7">
                                          <path d="M2.65999 6.23012C2.46999 6.23012 2.27999 6.16012 2.12999 6.01012L0.51999 4.40012C0.22999 4.11012 0.22999 3.63012 0.51999 3.34012C0.80999 3.05012 1.28999 3.05012 1.57999 3.34012L2.65999 4.42012L6.42999 0.650117C6.71999 0.360117 7.19999 0.360117 7.48999 0.650117C7.77999 0.940117 7.77999 1.42012 7.48999 1.71012L3.18999 6.01012C3.03999 6.16012 2.84999 6.23012 2.65999 6.23012Z" fill="#18a24b" />{" "}
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="flex">
                                        <svg width="8" height="7" fill="none" viewBox="0 0 8 7">
                                          <path d="M2.65999 6.23012C2.46999 6.23012 2.27999 6.16012 2.12999 6.01012L0.51999 4.40012C0.22999 4.11012 0.22999 3.63012 0.51999 3.34012C0.80999 3.05012 1.28999 3.05012 1.57999 3.34012L2.65999 4.42012L6.42999 0.650117C6.71999 0.360117 7.19999 0.360117 7.48999 0.650117C7.77999 0.940117 7.77999 1.42012 7.48999 1.71012L3.18999 6.01012C3.03999 6.16012 2.84999 6.23012 2.65999 6.23012Z" fill="#292D3250" />{" "}
                                        </svg>
                                        <svg width="8" height="7" fill="none" viewBox="0 0 8 7">
                                          <path d="M2.65999 6.23012C2.46999 6.23012 2.27999 6.16012 2.12999 6.01012L0.51999 4.40012C0.22999 4.11012 0.22999 3.63012 0.51999 3.34012C0.80999 3.05012 1.28999 3.05012 1.57999 3.34012L2.65999 4.42012L6.42999 0.650117C6.71999 0.360117 7.19999 0.360117 7.48999 0.650117C7.77999 0.940117 7.77999 1.42012 7.48999 1.71012L3.18999 6.01012C3.03999 6.16012 2.84999 6.23012 2.65999 6.23012Z" fill="#292D3250" />{" "}
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </span>
                          
                        </li>
                      ))
                    : isLoggedIn?._id && (
                        <div className="mb-[30px] mt-[130px] text-[20px] w-full   text-center flex flex-col content-center justify-center items-center mx-auto  text-gray-900   ">
                          <p>No Messages Yet...</p>
                        </div>
                      )}
                      <div  ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* ↑ Chat Messages ↑ */}

            {/* ↓ Chat Footer Toolbar ↓ */}
            {!openGroupMenu && (
              <div className={`absolute flex bottom-0 h-auto justify-between px-3 items-center bg-gray-50 min-h-[40px] border-t-[1px] border-gray-900 rounded-t-lg`}>
                {fileToUpload && !voiceURL && (
                  <div onClick={() => setFileToUpload()} className="group cursor-pointer z-50 absolute ">
                    <svg className="flex items-center justify-center mx-auto  ml-[5px] mt-[2px]" width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path className=" transition-all duration-300 opacity-0 group-hover:opacity-100" d="M21 6.72998C20.98 6.72998 20.95 6.72998 20.92 6.72998C15.63 6.19998 10.35 5.99998 5.12 6.52998L3.08 6.72998C2.66 6.76998 2.29 6.46998 2.25 6.04998C2.21 5.62998 2.51 5.26998 2.92 5.22998L4.96 5.02998C10.28 4.48998 15.67 4.69998 21.07 5.22998C21.48 5.26998 21.78 5.63998 21.74 6.04998C21.71 6.43998 21.38 6.72998 21 6.72998Z" fill="#292D32" />
                      <path className=" transition-all duration-300 opacity-0 group-hover:opacity-100" d="M8.5 5.72C8.46 5.72 8.42 5.72 8.37 5.71C7.97 5.64 7.69 5.25 7.76 4.85L7.98 3.54C8.14 2.58 8.36 1.25 10.69 1.25H13.31C15.65 1.25 15.87 2.63 16.02 3.55L16.24 4.85C16.31 5.26 16.03 5.65 15.63 5.71C15.22 5.78 14.83 5.5 14.77 5.1L14.55 3.8C14.41 2.93 14.38 2.76 13.32 2.76H10.7C9.64 2.76 9.62 2.9 9.47 3.79L9.24 5.09C9.18 5.46 8.86 5.72 8.5 5.72Z" fill="#292D32" />
                      <path className=" transition-all duration-300 opacity-0 group-hover:opacity-100" d="M15.21 22.75H8.79C5.3 22.75 5.16 20.82 5.05 19.26L4.4 9.18995C4.37 8.77995 4.69 8.41995 5.1 8.38995C5.52 8.36995 5.87 8.67995 5.9 9.08995L6.55 19.16C6.66 20.68 6.7 21.25 8.79 21.25H15.21C17.31 21.25 17.35 20.68 17.45 19.16L18.1 9.08995C18.13 8.67995 18.49 8.36995 18.9 8.38995C19.31 8.41995 19.63 8.76995 19.6 9.18995L18.95 19.26C18.84 20.82 18.7 22.75 15.21 22.75Z" fill="#292D32" />
                      <path className=" transition-all duration-300 opacity-0 group-hover:opacity-100" d="M13.66 17.25H10.33C9.92 17.25 9.58 16.91 9.58 16.5C9.58 16.09 9.92 15.75 10.33 15.75H13.66C14.07 15.75 14.41 16.09 14.41 16.5C14.41 16.91 14.07 17.25 13.66 17.25Z" fill="#292D32" />
                      <path className=" transition-all duration-300 opacity-0 group-hover:opacity-100" d="M14.5 13.25H9.5C9.09 13.25 8.75 12.91 8.75 12.5C8.75 12.09 9.09 11.75 9.5 11.75H14.5C14.91 11.75 15.25 12.09 15.25 12.5C15.25 12.91 14.91 13.25 14.5 13.25Z" fill="#292D32" />
                    </svg>
                  </div>
                )}

                <div className=" flex  rounded-t-[4px]   w-[100%]  items-center gap-[5px] ">
                  {voiceURL ? (
                    <button onClick={setDeleteVoice}>
                      <svg id="delete-voice" className="hover:opacity-70 transition-all duration-300" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path d="M21 6.72998C20.98 6.72998 20.95 6.72998 20.92 6.72998C15.63 6.19998 10.35 5.99998 5.12 6.52998L3.08 6.72998C2.66 6.76998 2.29 6.46998 2.25 6.04998C2.21 5.62998 2.51 5.26998 2.92 5.22998L4.96 5.02998C10.28 4.48998 15.67 4.69998 21.07 5.22998C21.48 5.26998 21.78 5.63998 21.74 6.04998C21.71 6.43998 21.38 6.72998 21 6.72998Z" fill="#292D32" />
                        <path d="M8.5 5.72C8.46 5.72 8.42 5.72 8.37 5.71C7.97 5.64 7.69 5.25 7.76 4.85L7.98 3.54C8.14 2.58 8.36 1.25 10.69 1.25H13.31C15.65 1.25 15.87 2.63 16.02 3.55L16.24 4.85C16.31 5.26 16.03 5.65 15.63 5.71C15.22 5.78 14.83 5.5 14.77 5.1L14.55 3.8C14.41 2.93 14.38 2.76 13.32 2.76H10.7C9.64 2.76 9.62 2.9 9.47 3.79L9.24 5.09C9.18 5.46 8.86 5.72 8.5 5.72Z" fill="#292D32" />
                        <path d="M15.21 22.75H8.79C5.3 22.75 5.16 20.82 5.05 19.26L4.4 9.18995C4.37 8.77995 4.69 8.41995 5.1 8.38995C5.52 8.36995 5.87 8.67995 5.9 9.08995L6.55 19.16C6.66 20.68 6.7 21.25 8.79 21.25H15.21C17.31 21.25 17.35 20.68 17.45 19.16L18.1 9.08995C18.13 8.67995 18.49 8.36995 18.9 8.38995C19.31 8.41995 19.63 8.76995 19.6 9.18995L18.95 19.26C18.84 20.82 18.7 22.75 15.21 22.75Z" fill="#292D32" />
                        <path d="M13.66 17.25H10.33C9.92 17.25 9.58 16.91 9.58 16.5C9.58 16.09 9.92 15.75 10.33 15.75H13.66C14.07 15.75 14.41 16.09 14.41 16.5C14.41 16.91 14.07 17.25 13.66 17.25Z" fill="#292D32" />
                        <path d="M14.5 13.25H9.5C9.09 13.25 8.75 12.91 8.75 12.5C8.75 12.09 9.09 11.75 9.5 11.75H14.5C14.91 11.75 15.25 12.09 15.25 12.5C15.25 12.91 14.91 13.25 14.5 13.25Z" fill="#292D32" />{" "}
                      </svg>
                    </button>
                  ) : (
                    <div>
                      <label className="cursor-pointer" htmlFor="file-upload">
                        {fileToUpload ? (
                          <div className="">
                            {fileToUpload.type.includes("image") ? (
                              <div>
                                <Image className={`rounded-lg w-[24px] h-[24px] opacity-50`} src={URL.createObjectURL(fileToUpload)} width={24} height={24} alt="" />
                              </div>
                            ) : (
                              <div>
                                <div className=" ">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17 22.75H7C2.59 22.75 1.25 21.41 1.25 17V7C1.25 2.59 2.59 1.25 7 1.25H8.5C10.25 1.25 10.8 1.82 11.5 2.75L13 4.75C13.33 5.19 13.38 5.25 14 5.25H17C21.41 5.25 22.75 6.59 22.75 11V17C22.75 21.41 21.41 22.75 17 22.75ZM7 2.75C3.42 2.75 2.75 3.43 2.75 7V17C2.75 20.57 3.42 21.25 7 21.25H17C20.58 21.25 21.25 20.57 21.25 17V11C21.25 7.43 20.58 6.75 17 6.75H14C12.72 6.75 12.3 6.31 11.8 5.65L10.3 3.65C9.78 2.96 9.62 2.75 8.5 2.75H7Z" fill="#292D32" />
                                    <path d="M20 7.13C19.59 7.13 19.25 6.79 19.25 6.38V5C19.25 3.42 18.58 2.75 17 2.75H8C7.59 2.75 7.25 2.41 7.25 2C7.25 1.59 7.59 1.25 8 1.25H17C19.42 1.25 20.75 2.58 20.75 5V6.38C20.75 6.79 20.41 7.13 20 7.13Z" fill="#292D32" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <svg id="select-attachment" className="hover:opacity-70 transition-all duration-300" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path
                              d="M12.33 21.34C11.24 21.34 10.15 20.93 9.32004 20.1C7.66004 18.44 7.66004 15.75 9.32004 14.09L11.8 11.62C12.09 11.33 12.57 11.33 12.86 11.62C13.15 11.91 13.15 12.39 12.86 12.68L10.38 15.15C9.31004 16.22 9.31004 17.97 10.38 19.04C11.45 20.11 13.2 20.11 14.27 19.04L18.16 15.15C19.34 13.97 19.99 12.4 19.99 10.73C19.99 9.05998 19.34 7.48998 18.16 6.30999C15.72 3.86999 11.76 3.86999 9.32004 6.30999L5.08004 10.55C4.09004 11.54 3.54004 12.86 3.54004 14.26C3.54004 15.66 4.09004 16.98 5.08004 17.97C5.37004 18.26 5.37004 18.74 5.08004 19.03C4.79004 19.32 4.31004 19.32 4.02004 19.03C2.75004 17.75 2.04004 16.06 2.04004 14.26C2.04004 12.46 2.74004 10.76 4.02004 9.48998L8.26004 5.24999C11.28 2.22999 16.2 2.22999 19.22 5.24999C20.68 6.70999 21.49 8.65998 21.49 10.73C21.49 12.8 20.68 14.75 19.22 16.21L15.33 20.1C14.5 20.93 13.42 21.34 12.33 21.34Z"
                              fill="#292D32"
                            />
                          </svg>
                        )}
                      </label>
                      <input id="file-upload" type="file" accept={["image/*", "application/zip", "application/pdf"]} className="hidden" onChange={(event) => selectFileForUpload(event)} />
                    </div>
                  )}

                  {voiceURL ? (
                    <div className="flex w-[165px] h-[35px] my-[5px] border-[1px] border-solid border-gray-900 bg-blue-50 rounded-lg justify-between">
                      {voiceURL && voiceDuration > 0 && <p className="mt-[5px] ml-[5px]">{(voiceDuration - voiceCurrentTime).toFixed(0) === "0" ? `${voiceDuration.toFixed(1)}″` : `-${(voiceDuration - voiceCurrentTime).toFixed(1)}″`}</p>}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" preserveAspectRatio="none" className="w-[90px] ml-[5px]">
                        <path d="M 0 25 Q 12.5 15, 25 25 Q 37.5 35, 50 25 Q 62.5 15, 75 25 Q 87.5 35, 100 25" fill="none" stroke="black" strokeWidth="2" style={{ transform: `scaleX(${(voiceCurrentTime / voiceDuration) * 2})` }} />
                      </svg>
                      <audio hidden ref={voiceRef} src={voiceURL} controls className="w-full h-10 bg-gray-300 rounded-[4px]" />
                      <div className="flex w-[24px] h-full mr-[5px]">
                        {(voiceRef.current && voiceRef.current.paused) || voiceDuration - voiceCurrentTime <= 0 ? (
                          <button className="hover:opacity-70 transition-all duration-300" onClick={() => voiceRef.current.play()} disabled={!voiceURL}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path d="M7.87 21.28C7.08 21.28 6.33 21.09 5.67 20.71C4.11 19.81 3.25 17.98 3.25 15.57V8.43999C3.25 6.01999 4.11 4.19999 5.67 3.29999C7.23 2.39999 9.24 2.56999 11.34 3.77999L17.51 7.33999C19.6 8.54999 20.76 10.21 20.76 12.01C20.76 13.81 19.61 15.47 17.51 16.68L11.34 20.24C10.13 20.93 8.95 21.28 7.87 21.28ZM7.87 4.21999C7.33 4.21999 6.85 4.33999 6.42 4.58999C5.34 5.20999 4.75 6.57999 4.75 8.43999V15.56C4.75 17.42 5.34 18.78 6.42 19.41C7.5 20.04 8.98 19.86 10.59 18.93L16.76 15.37C18.37 14.44 19.26 13.25 19.26 12C19.26 10.75 18.37 9.55999 16.76 8.62999L10.59 5.06999C9.61 4.50999 8.69 4.21999 7.87 4.21999Z" fill="#292D32" />{" "}
                            </svg>
                          </button>
                        ) : (
                          <button className="hover:opacity-70 transition-all duration-300" onClick={() => voiceRef.current.pause()} disabled={!voiceURL}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path d="M8.64 21.75H5.01C3.15 21.75 2.25 20.89 2.25 19.11V4.89C2.25 3.11 3.15 2.25 5.01 2.25H8.64C10.5 2.25 11.4 3.11 11.4 4.89V19.11C11.4 20.89 10.5 21.75 8.64 21.75ZM5.01 3.75C3.93 3.75 3.75 4.02 3.75 4.89V19.11C3.75 19.98 3.92 20.25 5.01 20.25H8.64C9.72 20.25 9.9 19.98 9.9 19.11V4.89C9.9 4.02 9.73 3.75 8.64 3.75H5.01Z" fill="#292D32" />
                              <path d="M18.9901 21.75H15.3601C13.5001 21.75 12.6001 20.89 12.6001 19.11V4.89C12.6001 3.11 13.5001 2.25 15.3601 2.25H18.9901C20.8501 2.25 21.7501 3.11 21.7501 4.89V19.11C21.7501 20.89 20.8501 21.75 18.9901 21.75ZM15.3601 3.75C14.2801 3.75 14.1001 4.02 14.1001 4.89V19.11C14.1001 19.98 14.2701 20.25 15.3601 20.25H18.9901C20.0701 20.25 20.2501 19.98 20.2501 19.11V4.89C20.2501 4.02 20.0801 3.75 18.9901 3.75H15.3601Z" fill="#292D32" />{" "}
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <textarea
                      rows={1}
                      className={`border-[1px] my-[5px] resize-y  h-auto max-h-[100px] min-h-[35px] rounded-lg border-solid border-gray-900 focus:outline-none p-1 placeholder:text-[#00000050]   w-[165px]    ${recording && "bg-red-50 animate-pulse"}`}
                      type="text"
                      disabled={recording || sending}
                      placeholder={!recording && "Message"}
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={() => socket.emit("typing", { status: "typing...", room, user: isLoggedIn?._id, userName: `${isLoggedIn?.firstName} ${isLoggedIn?.lastName}` })}
                      onBlur={() => socket.emit("typing", { status: "", room, user: isLoggedIn?._id, userName: `${isLoggedIn?.firstName} ${isLoggedIn?.lastName}` })}
                      onPaste={() => socket.emit("typing", { status: "typing...", room, user: isLoggedIn?._id, userName: `${isLoggedIn?.firstName} ${isLoggedIn?.lastName}` })}
                    />
                  )}

                  {sending ? (
                    <svg className="dotLoaderBlack" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path className="dotBlack dotBlack-1" d="M3 16.5C2.59 16.5 2.25 16.16 2.25 15.75V8.25C2.25 7.84 2.59 7.5 3 7.5C3.41 7.5 3.75 7.84 3.75 8.25V15.75C3.75 16.16 3.41 16.5 3 16.5Z" fill="#292D32" />
                      <path className="dotBlack dotBlack-2" d="M7.5 19C7.09 19 6.75 18.66 6.75 18.25V5.75C6.75 5.34 7.09 5 7.5 5C7.91 5 8.25 5.34 8.25 5.75V18.25C8.25 18.66 7.91 19 7.5 19Z" fill="#292D32" />
                      <path className="dotBlack dotBlack-3" d="M12 21.5C11.59 21.5 11.25 21.16 11.25 20.75V3.25C11.25 2.84 11.59 2.5 12 2.5C12.41 2.5 12.75 2.84 12.75 3.25V20.75C12.75 21.16 12.41 21.5 12 21.5Z" fill="#292D32" />
                      <path className="dotBlack dotBlack-1" d="M16.5 19C16.09 19 15.75 18.66 15.75 18.25V5.75C15.75 5.34 16.09 5 16.5 5C16.91 5 17.25 5.34 17.25 5.75V18.25C17.25 18.66 16.91 19 16.5 19Z" fill="#292D32" />
                      <path className="dotBlack dotBlack-2" d="M21 16.5C20.59 16.5 20.25 16.16 20.25 15.75V8.25C20.25 7.84 20.59 7.5 21 7.5C21.41 7.5 21.75 7.84 21.75 8.25V15.75C21.75 16.16 21.41 16.5 21 16.5Z" fill="#292D32" />
                    </svg>
                  ) : (
                    <div className="mt-[7px]">
                      {messageInput?.length || fileToUpload ? (
                        <button id="send" className={`${(messageInput?.length || fileToUpload) && "cursor-pointer"} hover:opacity-70 transition-all duration-300`} disabled={!messageInput?.length && !fileToUpload} onClick={sendMessage}>
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path
                              d="M5.40999 21.75C4.28999 21.75 3.57999 21.37 3.12999 20.92C2.24999 20.04 1.62999 18.17 3.60999 14.2L4.47999 12.47C4.58999 12.24 4.58999 11.76 4.47999 11.53L3.60999 9.80002C1.61999 5.83002 2.24999 3.95002 3.12999 3.08002C3.99999 2.20002 5.87999 1.57002 9.83999 3.56002L18.4 7.84002C20.53 8.90002 21.7 10.38 21.7 12C21.7 13.62 20.53 15.1 18.41 16.16L9.84999 20.44C7.90999 21.41 6.46999 21.75 5.40999 21.75ZM5.40999 3.75002C4.86999 3.75002 4.44999 3.88002 4.18999 4.14002C3.45999 4.86002 3.74999 6.73002 4.94999 9.12002L5.81999 10.86C6.13999 11.51 6.13999 12.49 5.81999 13.14L4.94999 14.87C3.74999 17.27 3.45999 19.13 4.18999 19.85C4.90999 20.58 6.77999 20.29 9.17999 19.09L17.74 14.81C19.31 14.03 20.2 13 20.2 11.99C20.2 10.98 19.3 9.95002 17.73 9.17002L9.16999 4.90002C7.64999 4.14002 6.33999 3.75002 5.40999 3.75002Z"
                              fill="#101828"
                            />
                            <path d="M10.84 12.75H5.44C5.03 12.75 4.69 12.41 4.69 12C4.69 11.59 5.03 11.25 5.44 11.25H10.84C11.25 11.25 11.59 11.59 11.59 12C11.59 12.41 11.25 12.75 10.84 12.75Z" fill="#101828" />{" "}
                          </svg>
                        </button>
                      ) : recording ? (
                        <button className="hover:opacity-70 transition-all duration-300" onClick={stopRecording} disabled={!recording}>
                          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path d="M8 11.75C7.59 11.75 7.25 11.41 7.25 11V6C7.25 3.38 9.38 1.25 12 1.25C14.62 1.25 16.75 3.38 16.75 6V6.3C16.75 6.71 16.41 7.05 16 7.05C15.59 7.05 15.25 6.71 15.25 6.3V6C15.25 4.21 13.79 2.75 12 2.75C10.21 2.75 8.75 4.21 8.75 6V11C8.75 11.41 8.41 11.75 8 11.75Z" fill="#292D32" />
                            <path d="M11.9999 16.25C10.6599 16.25 9.37991 15.68 8.47991 14.69C8.19991 14.38 8.22991 13.91 8.52991 13.63C8.83991 13.35 9.30991 13.38 9.58991 13.68C10.1999 14.36 11.0799 14.75 11.9999 14.75C13.7899 14.75 15.2499 13.29 15.2499 11.5V11C15.2499 10.59 15.5899 10.25 15.9999 10.25C16.4099 10.25 16.7499 10.59 16.7499 11V11.5C16.7499 14.12 14.6199 16.25 11.9999 16.25Z" fill="#292D32" />
                            <path d="M12.0001 19.75C9.87006 19.75 7.83006 18.95 6.27006 17.5C5.97006 17.22 5.95006 16.74 6.23006 16.44C6.52006 16.13 7.00006 16.12 7.30006 16.4C8.58006 17.59 10.2501 18.25 12.0001 18.25C15.8001 18.25 18.9001 15.15 18.9001 11.35V9.65002C18.9001 9.24002 19.2401 8.90002 19.6501 8.90002C20.0601 8.90002 20.4001 9.24002 20.4001 9.65002V11.35C20.4001 15.98 16.6301 19.75 12.0001 19.75Z" fill="#292D32" />
                            <path d="M4.9501 15.08C4.6601 15.08 4.3801 14.91 4.2601 14.62C3.8201 13.58 3.6001 12.49 3.6001 11.35V9.65002C3.6001 9.24002 3.9401 8.90002 4.3501 8.90002C4.7601 8.90002 5.1001 9.24002 5.1001 9.65002V11.35C5.1001 12.28 5.2801 13.18 5.6401 14.03C5.8001 14.41 5.6201 14.85 5.2401 15.01C5.1501 15.06 5.0501 15.08 4.9501 15.08Z" fill="#292D32" />
                            <path d="M3.92011 19.74C3.73011 19.74 3.54011 19.67 3.39011 19.52C3.10011 19.23 3.10011 18.75 3.39011 18.46L19.5401 2.31003C19.8301 2.02003 20.3101 2.02003 20.6001 2.31003C20.8901 2.60003 20.8901 3.08003 20.6001 3.37003L4.46011 19.52C4.31011 19.67 4.12011 19.74 3.92011 19.74Z" fill="#292D32" />
                            <path d="M11 6.75C10.59 6.75 10.25 6.41 10.25 6V3C10.25 2.59 10.59 2.25 11 2.25C11.41 2.25 11.75 2.59 11.75 3V6C11.75 6.41 11.41 6.75 11 6.75Z" fill="#292D32" />
                            <path d="M12 22.75C11.59 22.75 11.25 22.41 11.25 22V19C11.25 18.59 11.59 18.25 12 18.25C12.41 18.25 12.75 18.59 12.75 19V22C12.75 22.41 12.41 22.75 12 22.75Z" fill="#292D32" />{" "}
                          </svg>
                        </button>
                      ) : (
                        !recording &&
                        !voiceURL && (
                          <button className="hover:opacity-70 transition-all duration-300" onClick={startRecording} disabled={recording}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path d="M12 16.25C9.38 16.25 7.25 14.12 7.25 11.5V6C7.25 3.38 9.38 1.25 12 1.25C14.62 1.25 16.75 3.38 16.75 6V11.5C16.75 14.12 14.62 16.25 12 16.25ZM12 2.75C10.21 2.75 8.75 4.21 8.75 6V11.5C8.75 13.29 10.21 14.75 12 14.75C13.79 14.75 15.25 13.29 15.25 11.5V6C15.25 4.21 13.79 2.75 12 2.75Z" fill="#292D32" />
                              <path d="M12.0001 19.75C7.3701 19.75 3.6001 15.98 3.6001 11.35V9.65002C3.6001 9.24002 3.9401 8.90002 4.3501 8.90002C4.7601 8.90002 5.1001 9.24002 5.1001 9.65002V11.35C5.1001 15.15 8.2001 18.25 12.0001 18.25C15.8001 18.25 18.9001 15.15 18.9001 11.35V9.65002C18.9001 9.24002 19.2401 8.90002 19.6501 8.90002C20.0601 8.90002 20.4001 9.24002 20.4001 9.65002V11.35C20.4001 15.98 16.6301 19.75 12.0001 19.75Z" fill="#292D32" />
                              <path d="M13.3901 7.18001C13.3101 7.18001 13.2201 7.17001 13.1301 7.14001C12.4001 6.87001 11.6001 6.87001 10.8701 7.14001C10.4801 7.28001 10.0501 7.08001 9.91012 6.69001C9.77012 6.30001 9.97012 5.87001 10.3601 5.73001C11.4201 5.35001 12.5901 5.35001 13.6501 5.73001C14.0401 5.87001 14.2401 6.30001 14.1001 6.69001C13.9801 6.99001 13.6901 7.18001 13.3901 7.18001Z" fill="#292D32" />
                              <path d="M12.8001 9.30001C12.7301 9.30001 12.6701 9.29001 12.6001 9.27001C12.2001 9.16001 11.7901 9.16001 11.3901 9.27001C10.9901 9.38001 10.5801 9.14001 10.4701 8.74001C10.3601 8.35001 10.6001 7.94001 11.0001 7.83001C11.6501 7.65001 12.3501 7.65001 13.0001 7.83001C13.4001 7.94001 13.6401 8.35001 13.5301 8.75001C13.4401 9.08001 13.1301 9.30001 12.8001 9.30001Z" fill="#292D32" />
                              <path d="M12 22.75C11.59 22.75 11.25 22.41 11.25 22V19C11.25 18.59 11.59 18.25 12 18.25C12.41 18.25 12.75 18.59 12.75 19V22C12.75 22.41 12.41 22.75 12 22.75Z" fill="#292D32" />{" "}
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ↑ Chat Footer Toolbar ↑ */}
          </div>
        )}

        {/* ↑ Chat Page ↑ */}

        {/* ↓ Group Chat Menu Page ↓ */}
        <div className={`overflow-clip`}>
          {openGroupMenu && (
            <div className="px-3 overflow-clip h-[350px]">
              <div className={`h-full overflow-y-auto`}>
                {!addMember && (
                  <div className="flex  flex-col gap-1 mt-1 ">
                    <p className="text-[20px] font-semibold">Members ({group?.members.length}) </p>
                    {group &&
                      group?.members?.map(({ _id, firstName, lastName }, index) => (
                        <div key={index} className={` bg-[#ffffff90] w-full justify-between animate-appearFast flex items-center h-[40px]  border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1  transition-all duration-300`}>
                          <div className="flex">
                            <div className={`w-[25px] h-[25px] bg-gray-300 ${onlineUsers?.user == _id ? "border-green-500" : "border-red-500"} rounded-lg border-b-[3px]`}></div>

                            <div className="flex ml-[5px] font-semibold">
                              <p>{_id === isLoggedIn._id ? "Me" : `${firstName} ${lastName}`}</p>
                            </div>
                          </div>

                          {group?.masters.some((master) => master._id == _id) && (
                            <div className="flex gap-[3px]  bg-yellow-100 rounded-xl h-fit p-1">
                              <svg id="master" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M16.7 19.73H7.3C6.56 19.73 5.81 19.2 5.56 18.51L1.42 6.91998C0.910004 5.45998 1.28 4.78998 1.68 4.48998C2.08 4.18998 2.83 4.00998 4.09 4.90998L7.99 7.69998C8.11 7.76998 8.22 7.79998 8.3 7.77998C8.39 7.74998 8.46 7.66998 8.51 7.52998L10.27 2.83998C10.8 1.43998 11.58 1.22998 12 1.22998C12.42 1.22998 13.2 1.43998 13.73 2.83998L15.49 7.52998C15.54 7.65998 15.61 7.74998 15.7 7.77998C15.79 7.80998 15.9 7.77998 16.01 7.68998L19.67 5.07998C21.01 4.11998 21.79 4.30998 22.22 4.61998C22.64 4.93998 23.03 5.64998 22.48 7.19998L18.44 18.51C18.19 19.2 17.44 19.73 16.7 19.73ZM2.68 5.80998C2.7 5.94998 2.74 6.14998 2.84 6.40998L6.98 18C7.02 18.1 7.2 18.23 7.3 18.23H16.7C16.81 18.23 16.99 18.1 17.02 18L21.06 6.69998C21.2 6.31998 21.24 6.05998 21.25 5.90998C21.1 5.95998 20.87 6.06998 20.54 6.30998L16.88 8.91998C16.38 9.26998 15.79 9.37998 15.26 9.21998C14.73 9.05998 14.3 8.63998 14.08 8.06998L12.32 3.37998C12.19 3.02998 12.07 2.85998 12 2.77998C11.93 2.85998 11.81 3.02998 11.68 3.36998L9.92 8.05998C9.71 8.62998 9.28 9.04998 8.74 9.20998C8.21 9.36998 7.61 9.25998 7.12 8.90998L3.22 6.11998C2.99 5.95998 2.81 5.85998 2.68 5.80998Z"
                                  fill="#FBBF24"
                                />
                                <path d="M17.5 22.75H6.5C6.09 22.75 5.75 22.41 5.75 22C5.75 21.59 6.09 21.25 6.5 21.25H17.5C17.91 21.25 18.25 21.59 18.25 22C18.25 22.41 17.91 22.75 17.5 22.75Z" fill="#FBBF24" />
                                <path d="M14.5 14.75H9.5C9.09 14.75 8.75 14.41 8.75 14C8.75 13.59 9.09 13.25 9.5 13.25H14.5C14.91 13.25 15.25 13.59 15.25 14C15.25 14.41 14.91 14.75 14.5 14.75Z" fill="#FBBF24" />
                              </svg>
                            </div>
                          )}

                          <div className={`flex gap-[5px]`}>
                            {(group.masters.some((master) => master._id !== isLoggedIn._id) || (group.masters.some((master) => master._id !== isLoggedIn._id) && group.masters.length > 1)) && _id === isLoggedIn._id && (
                              <button className="bg-red-100 p-1 hover:bg-red-200 transition-all duration-300 rounded-xl" onClick={() => leaveGroup()}>
                                <svg id="leave-group" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M15.24 22.27H15.11C10.67 22.27 8.53002 20.52 8.16002 16.6C8.12002 16.19 8.42002 15.82 8.84002 15.78C9.24002 15.74 9.62002 16.05 9.66002 16.46C9.95002 19.6 11.43 20.77 15.12 20.77H15.25C19.32 20.77 20.76 19.33 20.76 15.26V8.73998C20.76 4.66998 19.32 3.22998 15.25 3.22998H15.12C11.41 3.22998 9.93002 4.41998 9.66002 7.61998C9.61002 8.02998 9.26002 8.33998 8.84002 8.29998C8.42002 8.26998 8.12001 7.89998 8.15001 7.48998C8.49001 3.50998 10.64 1.72998 15.11 1.72998H15.24C20.15 1.72998 22.25 3.82998 22.25 8.73998V15.26C22.25 20.17 20.15 22.27 15.24 22.27Z" fill="#DC2626" />
                                  <path d="M15.0001 12.75H3.62012C3.21012 12.75 2.87012 12.41 2.87012 12C2.87012 11.59 3.21012 11.25 3.62012 11.25H15.0001C15.4101 11.25 15.7501 11.59 15.7501 12C15.7501 12.41 15.4101 12.75 15.0001 12.75Z" fill="#DC2626" />
                                  <path d="M5.84994 16.1C5.65994 16.1 5.46994 16.03 5.31994 15.88L1.96994 12.53C1.67994 12.24 1.67994 11.76 1.96994 11.47L5.31994 8.11997C5.60994 7.82997 6.08994 7.82997 6.37994 8.11997C6.66994 8.40997 6.66994 8.88997 6.37994 9.17997L3.55994 12L6.37994 14.82C6.66994 15.11 6.66994 15.59 6.37994 15.88C6.23994 16.03 6.03994 16.1 5.84994 16.1Z" fill="#DC2626" />
                                </svg>
                              </button>
                            )}
                            {!group.members.filter((member) => group.masters.some((master) => master._id == member._id)).some((item) => item._id == _id) && _id !== isLoggedIn?._id && group.masters.some((master) => master._id == isLoggedIn._id) && (
                              <button className="flex gap-[3px]  bg-green-100 hover:bg-green-200 transition-all duration-300 rounded-xl h-fit p-1" onClick={() => makeMaster(_id)}>
                                <svg id="make-master" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17 22.75H7C2.59 22.75 1.25 21.41 1.25 17V15C1.25 10.59 2.59 9.25 7 9.25H17C21.41 9.25 22.75 10.59 22.75 15V17C22.75 21.41 21.41 22.75 17 22.75ZM7 10.75C3.42 10.75 2.75 11.43 2.75 15V17C2.75 20.57 3.42 21.25 7 21.25H17C20.58 21.25 21.25 20.57 21.25 17V15C21.25 11.43 20.58 10.75 17 10.75H7Z" fill="#16A34A" />
                                  <path d="M6 10.75C5.59 10.75 5.25 10.41 5.25 10V8C5.25 5.1 5.95 1.25 12 1.25C16.48 1.25 18.75 3.18 18.75 7C18.75 7.41 18.41 7.75 18 7.75C17.59 7.75 17.25 7.41 17.25 7C17.25 5.02 16.65 2.75 12 2.75C7.64 2.75 6.75 4.85 6.75 8V10C6.75 10.41 6.41 10.75 6 10.75Z" fill="#16A34A" />
                                  <path d="M12 19.25C10.21 19.25 8.75 17.79 8.75 16C8.75 14.21 10.21 12.75 12 12.75C13.79 12.75 15.25 14.21 15.25 16C15.25 17.79 13.79 19.25 12 19.25ZM12 14.25C11.04 14.25 10.25 15.04 10.25 16C10.25 16.96 11.04 17.75 12 17.75C12.96 17.75 13.75 16.96 13.75 16C13.75 15.04 12.96 14.25 12 14.25Z" fill="#16A34A" />
                                </svg>
                              </button>
                            )}
                            {group.members.filter((member) => group.masters.some((master) => master._id == member._id)).some((item) => item._id == _id) && _id !== isLoggedIn?._id && group.masters.some((master) => master._id == isLoggedIn._id) && (
                              <button className="bg-red-100 p-1 hover:bg-red-200 transition-all duration-300 rounded-xl" onClick={() => unmakeMaster(_id)}>
                                <svg id="revoke-permissions" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12.0001 19.25C10.9801 19.25 10.0401 18.79 9.42005 17.98C9.17005 17.65 9.23005 17.18 9.56005 16.93C9.89005 16.68 10.3601 16.74 10.6101 17.07C10.9401 17.51 11.4501 17.75 12.0001 17.75C12.9601 17.75 13.7501 16.96 13.7501 16C13.7501 15.61 13.6301 15.24 13.3901 14.94C13.1401 14.61 13.2001 14.14 13.5301 13.89C13.8601 13.64 14.3301 13.7 14.5801 14.03C15.0201 14.6 15.2501 15.28 15.2501 16C15.2501 17.79 13.7901 19.25 12.0001 19.25Z" fill="#DC2626" />
                                  <path d="M17 22.75H7C6.63 22.75 6.28 22.74 5.95 22.72C5.54 22.7 5.22 22.34 5.24 21.93C5.26 21.52 5.61 21.22 6.03 21.22C6.33 21.24 6.65 21.24 6.99 21.24H16.99C20.56 21.24 21.24 20.56 21.24 16.99V14.99C21.24 11.48 20.5 10.91 17.95 10.76C17.65 10.74 17.33 10.74 16.99 10.74H7C3.43 10.74 2.75 11.42 2.75 14.99V16.99C2.75 18.73 2.95 19.76 3.41 20.32C3.67 20.64 3.62 21.12 3.29 21.37C2.97 21.63 2.5 21.58 2.24 21.25C1.54 20.4 1.25 19.16 1.25 17V15C1.25 10.59 2.59 9.25 7 9.25H17C17.37 9.25 17.72 9.26 18.04 9.28C22 9.5 22.75 11.46 22.75 15V17C22.75 21.41 21.41 22.75 17 22.75Z" fill="#DC2626" />
                                  <path d="M6 10.75C5.59 10.75 5.25 10.41 5.25 10V8C5.25 5.1 5.95 1.25 12 1.25C16.07 1.25 18.18 2.58 18.64 5.44C18.71 5.85 18.43 6.23 18.02 6.3C17.61 6.37 17.23 6.09 17.16 5.68C16.91 4.16 16.12 2.75 12 2.75C7.64 2.75 6.75 4.85 6.75 8V10C6.75 10.41 6.41 10.75 6 10.75Z" fill="#DC2626" />
                                  <path d="M1.99994 22.7499C1.80994 22.7499 1.61994 22.6799 1.46994 22.5299C1.17994 22.2399 1.17994 21.7599 1.46994 21.4699L21.4699 1.46994C21.7599 1.17994 22.2399 1.17994 22.5299 1.46994C22.8199 1.75994 22.8199 2.23994 22.5299 2.52994L2.52994 22.5299C2.37994 22.6799 2.18994 22.7499 1.99994 22.7499Z" fill="#DC2626" />
                                </svg>
                              </button>
                            )}
                            {group?.masters.some((master) => master._id == isLoggedIn?._id) && _id !== isLoggedIn._id && (
                              <button onClick={() => removeMembersFromGroup({ memberToRemove: _id })} className="bg-red-100 p-1 hover:bg-red-200 transition-all duration-300 rounded-xl">
                                <svg id="revoke-permissions" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path
                                    d="M12 22.7599C10.91 22.7599 9.83002 22.4399 8.98002 21.8099L4.68002 18.5999C3.54002 17.7499 2.65002 15.9699 2.65002 14.5599V7.11994C2.65002 5.57994 3.78002 3.93994 5.23002 3.39994L10.22 1.52994C11.21 1.15994 12.77 1.15994 13.76 1.52994L18.75 3.39994C20.2 3.93994 21.33 5.57994 21.33 7.11994V14.5499C21.33 15.9699 20.44 17.7399 19.3 18.5899L15 21.7999C14.17 22.4399 13.09 22.7599 12 22.7599ZM10.75 2.93994L5.76002 4.80994C4.91002 5.12994 4.16002 6.20994 4.16002 7.12994V14.5599C4.16002 15.5099 4.83002 16.8399 5.58002 17.3999L9.88002 20.6099C11.03 21.4699 12.97 21.4699 14.13 20.6099L18.43 17.3999C19.19 16.8299 19.85 15.5099 19.85 14.5599V7.11994C19.85 6.20994 19.1 5.12994 18.25 4.79994L13.26 2.92994C12.58 2.68994 11.42 2.68994 10.75 2.93994Z"
                                    fill="#DC2626"
                                  />
                                  <path d="M14.15 14.1899C13.96 14.1899 13.77 14.1199 13.62 13.9699L9.36997 9.71988C9.07997 9.42988 9.07997 8.94988 9.36997 8.65988C9.65997 8.36988 10.14 8.36988 10.43 8.65988L14.68 12.9099C14.97 13.1999 14.97 13.6799 14.68 13.9699C14.53 14.1099 14.34 14.1899 14.15 14.1899Z" fill="#DC2626" />
                                  <path d="M9.85004 14.2299C9.66004 14.2299 9.47004 14.1599 9.32004 14.0099C9.03004 13.7199 9.03004 13.2399 9.32004 12.9499L13.57 8.69992C13.86 8.40992 14.34 8.40992 14.63 8.69992C14.92 8.98992 14.92 9.46992 14.63 9.75992L10.38 14.0099C10.24 14.1599 10.04 14.2299 9.85004 14.2299Z" fill="#DC2626" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {!addMember && (
                  <button onClick={() => setAddMember(true)} className={`bg-gray-900 mt-[20px] mb-[2px] disabled:bg-gray-700 text-[20px] text-center text-gray-100 w-full h-[35px] hover:bg-gray-700 rounded-t-[4px] transition-all duration-300`}>
                    Add Member
                  </button>
                )}

                {addMember && <p className="mt-[10px] ml-[5px]">Select members, {membersToAdd.length} selected</p>}

                <div className="flex flex-col gap-2">
                  {addMember &&
                    users &&
                    users
                      .filter(({ _id }) => !group?.members.some((member) => member._id === _id))
                      .map(({ _id, firstName, lastName }, index) => (
                        <label key={index} className={`cursor-pointer ${membersToAdd.includes(_id) ? "bg-green-200" : "bg-[#ffffff90] hover:bg-white"} w-full animate-appearFast flex items-center h-[40px]  border-[1px] border-gray-900 rounded-xl border-b-[3px] shadow-sm p-1  transition-all duration-300`}>
                          <input className="hidden" type="checkbox" onChange={() => groupMembersToAddHandler(_id)} />
                          <div className="w-[25px] h-[25px] bg-gray-300 border-gray-900 rounded-lg border-b-[1px]"></div>

                          <div className="flex ml-[5px] font-semibold">
                            <p>
                              {firstName} {lastName}
                            </p>
                          </div>
                        </label>
                      ))}
                  {addMember && (
                    <button onClick={addSelectedMembersToGroup} disabled={!membersToAdd.length} className={`bg-gray-900 disabled:bg-gray-700 text-[20px] text-center text-gray-100 w-full h-[35px] hover:bg-gray-700 rounded-[4px] transition-all duration-300`}>
                      Add Selected Members
                    </button>
                  )}
                </div>
                <div>
                  {!addMember && group?.masters.some((master) => master._id == isLoggedIn?._id) && (
                    <div className="flex flex-col gap-[2px]">
                      <button className="h-[35px] bg-red-600 hover:bg-red-500 items-center flex transition-all duration-300 text-[20px] text-gray-100 px-2 py-1 text-center justify-center" onClick={() => deleteAllChatMessages()}>
                        Clear All Group Messages
                      </button>
                      <button className="h-[35px] bg-red-600 hover:bg-red-500 transition-all gap-[5px] duration-300 text-[20px] text-gray-100 rounded-b-[4px] px-2 py-1 flex items-center justify-center text-center" onClick={() => deleteGroup()}>
                        Delete Group
                      </button>
                    </div>
                  )}
                </div>
                {!addMember && (
                  <p className="border-t-[1px] border-solid border-gray-900 mt-[10px] mx-5 text-center">
                    Created at: {new Date(group.createdAt).toLocaleDateString("fa-IR-u-nu-latn")} {new Date(group.createdAt).toLocaleTimeString("fa-IR-u-nu-latn")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ↑ Group Chat Menu Page ↑ */}

        {/* ↓ Notification ↓ */}

        {notifications.map((notification, index) => (
          <div key={index} className={`z-50  text-[20px] absolute mx-auto font-SofiaSansExtraCondensed left-0 right-0 top-[20px] w-fit max-w-[300px] min-h-[35px] h-fit py-[5px] px-[10px] content-center items-center text-center rounded-[4px] bg-gray-900 text-gray-100 shadow-[4px] translate-y-[-60px] opacity-0 animate-fadeIn`}>
            <p>{notification.message}</p>
          </div>
        ))}
      </div>

      {/* ↑ Notification ↑ */}

      {/* ↓ Cropper ↓ */}

      <ChatCropperModal index={1} open={openChatCropperModal} close={() => setOpenChatCropperModal({ status: false, index: null })}>
        <Cropper className="absolute flex rounded-[4px] mx-3 w-[206px] h-[285px] mt-[13px] overflow-clip justify-center items-center" ref={cropperRef} zoomTo={1} src={file} background={true} responsive={true} guides={true} />
        <div className="absolute bottom-[15px] flex gap-[3px]  font-SofiaSansExtraCondensed justify-center w-[230px] h-fit px-3">
          <button className=" z-[50] text-[20px] w-[80%] h-[35px] bg-gray-900  text-gray-100 rounded-l-[4px] hover:bg-gray-700 transition-all duration-300" onClick={getCropData}>
            Crop
          </button>
          <button className="flex justify-center items-center mx-auto z-[50] text-[20px] w-[25%] h-[35px]  bg-red-600 hover:bg-red-500 text-gray-100 rounded-r-[4px]  transition-all duration-300" onClick={() => setOpenChatCropperModal({ status: false, index: null })}>
            Cancel
          </button>
        </div>
      </ChatCropperModal>

      {/* ↑ Cropper ↑ */}
    </>
  );
};

export default Messenger;
