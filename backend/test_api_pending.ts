import dotenv from 'dotenv';
dotenv.config();
import { generateToken } from './src/utils/jwt';
import fs from 'fs';

const token = generateToken({
  id_utilisateur: 1,
  email: 'superadmin@gp.com',
  role: { nom: 'SuperAdmin' },
  id_entreprise: 1
});

fetch('http://localhost:5000/api/superadmin/pending-users', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(async res => {
      const text = await res.text();
      fs.writeFileSync('out3.json', JSON.stringify({
        status: res.status,
        body: text
      }, null, 2));
      console.log("DONE");
  })
  .catch(console.error);
