import { Card, CardContent } from "../../ui/card";

export function ServiceProjectionDetails({ detail, children }) {
    const includedItems = Array.isArray(detail?.includedItems) ? detail.includedItems : [];

    return (
        <div className="space-y-4 text-sm text-gray-700">
            <div>
                <h4 className="font-semibold mb-2">{detail?.includedTitle || "What's Included:"}</h4>
                <ul className="space-y-1 ml-4">
                    {includedItems.map((item) => (
                        <li key={item}>
                            <span aria-hidden="true">&bull;</span> {item}
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h4 className="font-semibold mb-2">Duration:</h4>
                <p>{detail?.duration || "To be announced"}</p>
            </div>
            <div>
                <h4 className="font-semibold mb-2">Price:</h4>
                {children}
            </div>
        </div>
    );
}

export function ServiceProjectionNote({ detail, className = "bg-blue-50 border-blue-200" }) {
    if (!detail?.reviewNote) {
        return null;
    }

    return (
        <Card className={className}>
            <CardContent className="pt-6">
                <p className="text-sm text-gray-700">
                    <span aria-hidden="true">&#8505;&#65039;</span> {detail.reviewNote}
                </p>
            </CardContent>
        </Card>
    );
}
