import { describe, expect, it } from "vitest";
import { objectFields, suggestColumnMap } from "../src/mapping";

describe("objectFields", () => {
  it("lists the standard fields of an object plus any extra fields, without duplicates", () => {
    const fields = objectFields("salesforce.contact", ["Email", "Score__c"]);
    expect(fields).toEqual(
      expect.arrayContaining(["FirstName", "LastName", "Email", "AccountName", "Score__c"]),
    );
    expect(fields.filter((f) => f === "Email")).toHaveLength(1);
    expect(objectFields("other.person", ["name"])).toEqual(["name"]);
  });
});

describe("suggestColumnMap", () => {
  const target = objectFields("salesforce.contact", []);

  it("maps typical import headers onto the object's fields and system columns", () => {
    const map = suggestColumnMap(
      [
        "E-mail Address",
        "First Name",
        "Surname",
        "Company Name",
        "Job Title",
        "Lead Source",
        "Notes",
        "Record ID",
        "Created Date",
      ],
      target,
    );
    expect(map.fields).toEqual({
      "E-mail Address": "Email",
      "First Name": "FirstName",
      Surname: "LastName",
      "Company Name": "AccountName",
      "Job Title": "Title",
      "Lead Source": "LeadSource",
      Notes: "Notes",
    });
    expect(map.id).toBe("Record ID");
    expect(map.createdAt).toBe("Created Date");
    expect(map.updatedAt).toBeUndefined();
  });

  it("recognises Salesforce and HubSpot export column names", () => {
    const sf = suggestColumnMap(["Id", "CreatedDate", "LastModifiedDate", "Email"], target);
    expect(sf).toMatchObject({ id: "Id", createdAt: "CreatedDate", updatedAt: "LastModifiedDate" });
    const hs = suggestColumnMap(
      ["Record ID", "Create Date", "Last Modified Date", "Email"],
      objectFields("hubspot.contact", []),
    );
    expect(hs).toMatchObject({
      id: "Record ID",
      createdAt: "Create Date",
      updatedAt: "Last Modified Date",
    });
    expect(hs.fields.Email).toBe("email");
  });

  it("never maps two columns onto the same field", () => {
    const map = suggestColumnMap(["Email", "Email Address"], target);
    expect(map.fields).toEqual({ Email: "Email", "Email Address": "Email Address" });
  });
});
