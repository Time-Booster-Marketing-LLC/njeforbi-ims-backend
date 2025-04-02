import { useState } from 'react'; import { signIn } from '../../auth'; const SignIn = () => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const handleSignIn = async (e: { preventDefault: () => void; }) => {
    e.preventDefault(); try {
      await signIn(email, password);  } catch (error) { console.error('Error signing in:', error); } }; return ( <div> <h2>Sign In</h2> <form onSubmit={handleSignIn}> <input type='email' placeholder='Email' value={email} onChange={(e) => setEmail(e.target.value)} required /> <input type='password' placeholder='Password' value={password} onChange={(e) => setPassword(e.target.value)} required /> <button type='submit'>Sign In</button> </form> </div> ); }; export default SignIn; 
    