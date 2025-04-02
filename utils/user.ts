import axios from 'axios';
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      headers: {
      'Content-Type': 'application/json'
    },
});
