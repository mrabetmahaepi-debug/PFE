import type { Entreprise } from '../services/entreprise.service';
import { entrepriseService } from '../services/entreprise.service';
import { getCompanyAdmins } from './companyAdmins';

/** List API often omits `admins[]`; detail includes `utilisateur[]` with all tenant admins. */
export async function enrichEnterpriseListAdmins(
  enterprises: Entreprise[]
): Promise<Entreprise[]> {
  return Promise.all(
    enterprises.map(async (ent) => {
      const fromList = getCompanyAdmins(ent);
      if (fromList.length >= 2) {
        return {
          ...ent,
          admins: fromList,
          admin: fromList[0] ?? ent.admin ?? null,
        };
      }

      try {
        const detail = await entrepriseService.getById(ent.id_entreprise);
        if (!detail) {
          return {
            ...ent,
            admins: fromList,
            admin: fromList[0] ?? ent.admin ?? null,
          };
        }

        const admins = getCompanyAdmins(detail);
        return {
          ...ent,
          admins,
          admin: admins[0] ?? ent.admin ?? null,
        };
      } catch {
        return {
          ...ent,
          admins: fromList,
          admin: fromList[0] ?? ent.admin ?? null,
        };
      }
    })
  );
}
