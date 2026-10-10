import axios, { AxiosRequestConfig } from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';

export class TelegramDeliveryFailure extends ServiceUnavailableException {
  readonly retryAfterSeconds: number;
  constructor(message: string, error: unknown) {
    super(message);
    const seconds =
      axios.isAxiosError(error) && error.response?.status === 429
        ? Number(error.response.data?.parameters?.retry_after)
        : 0;
    this.retryAfterSeconds =
      Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 0;
  }
}

// Retry only an explicit rejection, never an ambiguous network timeout.
export async function telegramPost<T>(
  url: string,
  body: unknown,
  options: AxiosRequestConfig,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
) {
  try {
    return await axios.post<T>(url, body, options);
  } catch (error) {
    const seconds =
      axios.isAxiosError(error) && error.response?.status === 429
        ? Number(error.response.data?.parameters?.retry_after)
        : NaN;
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 30) throw error;
    await wait(Math.ceil(seconds * 1000));
    return axios.post<T>(url, body, options);
  }
}
