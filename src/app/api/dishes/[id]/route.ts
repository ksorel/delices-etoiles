import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("id reçu :", id);

  try {
    const client = await clientPromise;
    const db = client.db("delices");
    console.log("DB utilisée :", db.databaseName);

    // log des 3 premiers _id
    const all = await db.collection("dishes").find().limit(3).toArray();
    console.log("3 premiers _id :", all.map(d => d._id.toString()));

    // recherche par ObjectId
    const dish = await db
      .collection("dishes")
      .findOne({ _id: new ObjectId(id) });
    console.log("Résultat findOne :", dish);

    if (!dish)
      return NextResponse.json({ error: "Plat non trouvé" }, { status: 404 });

    return NextResponse.json({
      id: dish._id.toString(),
      name: dish.name,
      description: dish.description ?? { fr: "", en: "" }, // fallback
      price: dish.price,
      image: dish.image ?? "",
      category: dish.category,
    });
  } catch (err) {
    console.error("Erreur globale :", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}