import dotenv from 'dotenv';
dotenv.config();
import { generateToken } from './src/utils/jwt';
import fs from 'fs';

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
      const text = await res.text();
      fs.writeFileSync('out2.json', JSON.stringify({
        status: res.status,
        body: text
      }, null, 2));
      console.log("DONE");
  })
  .catch(err => {
      fs.writeFileSync('out2.json', String(err));
  });
