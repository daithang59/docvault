import axios from 'axios';
import { env } from '@/config/env';
import { apiEndpoints } from '@/lib/api/endpoints';
import type { CurrentUserDto } from './auth.types';

export async function getCurrentUser(accessToken: string): Promise<CurrentUserDto> {
  const response = await axios.get<CurrentUserDto>(
    `${env.API_BASE_URL}${apiEndpoints.auth.currentUser}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15_000,
    },
  );

  return response.data;
}
