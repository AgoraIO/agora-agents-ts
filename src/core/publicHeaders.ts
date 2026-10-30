/** Header namespace reserved for Agora's internal gateway and studio routing. */
export function isInternalHeader(name: string): boolean {
    const key = name.toLowerCase();
    return key.startsWith("x-studio-") || key === "x-consumer-username";
}
