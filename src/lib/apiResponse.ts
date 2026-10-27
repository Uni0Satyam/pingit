import { NextResponse } from "next/server";

export class ApiResponse {
  static success<T>(data: T, status = 200, message = "Success") {
    return NextResponse.json(
      {
        success: true,
        message,
        data,
      },
      { status }
    );
  }

  static error(message: string, status = 500, errorDetails: any = null) {
    return NextResponse.json(
      {
        success: false,
        message,
        ...(errorDetails && { details: errorDetails }), 
      },
      { status }
    );
  }
}
