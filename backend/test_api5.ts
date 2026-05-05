import dotenv from 'dotenv';
dotenv.config();
import { generateToken } from './src/utils/jwt';

const mockUser = {
  id_utilisateur: 1,
  email: 'superadmin@gp.com',
  role: { nom: 'SuperAdmin' },
  id_entreprise: 1
};

const token = generateToken(mockUser);

fetch('http://localhost:5000/api/superadmin/approvals', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(async res => {
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Body:', text);
  })
  .catch(console.error);
