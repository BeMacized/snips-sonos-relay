export interface SonosNotification {
    uri: string;
    length: number;
    volume?: number;
    onFinished?: () => void;
}
